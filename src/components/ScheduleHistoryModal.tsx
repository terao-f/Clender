import { useState, useEffect } from 'react';
import { X, Clock, User, Calendar, Edit, Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ScheduleHistory } from '../types';
import { ScheduleHistoryService } from '../services/scheduleHistoryService';

interface ScheduleHistoryModalProps {
  scheduleId: string;
  scheduleTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ScheduleHistoryModal({
  scheduleId,
  scheduleTitle,
  isOpen,
  onClose
}: ScheduleHistoryModalProps) {
  const [history, setHistory] = useState<ScheduleHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && scheduleId) {
      fetchHistory();
    }
  }, [isOpen, scheduleId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const historyData = await ScheduleHistoryService.getScheduleHistory(scheduleId);
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
        return 'bg-green-50 border-green-200';
      case 'update':
        return 'bg-blue-50 border-blue-200';
      case 'delete':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            スケジュール履歴: {scheduleTitle}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-2 text-gray-600">履歴を読み込み中...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>履歴がありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 ${getOperationColor(item.operationType)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getOperationIcon(item.operationType)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {getOperationText(item.operationType)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(item.operationTime, 'yyyy/MM/dd HH:mm', { locale: ja })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mb-2">
                          <User className="h-3 w-3 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {item.operatorName}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">
                          {item.description}
                        </p>
                        
                        {/* スケジュール詳細データの表示 */}
                        {item.scheduleData && item.operationType !== 'delete' && (
                          <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                            <h4 className="text-xs font-medium text-gray-700 mb-2">スケジュール詳細</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">タイトル:</span>
                                <span className="ml-1 text-gray-800">{item.scheduleData.title}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">種別:</span>
                                <span className="ml-1 text-gray-800">{item.scheduleData.type}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">開始:</span>
                                <span className="ml-1 text-gray-800">
                                  {format(new Date(item.scheduleData.startTime), 'yyyy/MM/dd HH:mm', { locale: ja })}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">終了:</span>
                                <span className="ml-1 text-gray-800">
                                  {format(new Date(item.scheduleData.endTime), 'yyyy/MM/dd HH:mm', { locale: ja })}
                                </span>
                              </div>
                              {item.scheduleData.participants && item.scheduleData.participants.length > 0 && (
                                <div className="col-span-2">
                                  <span className="text-gray-500">参加者:</span>
                                  <span className="ml-1 text-gray-800">
                                    {item.scheduleData.participants.length}名
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs">
                        {format(item.operationTime, 'HH:mm', { locale: ja })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}