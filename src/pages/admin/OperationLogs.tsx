import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { operationLogService, OperationLog } from '../../services/operationLogService';
import { ArrowLeft, RefreshCw, Download, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function OperationLogs() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterOperation, setFilterOperation] = useState<string>('ALL');

  // 管理者権限チェック（presidentとadminの両方にアクセス許可）
  useEffect(() => {
    console.log('🔍 OperationLogs - 権限チェック:', {
      currentUser: currentUser,
      role: currentUser?.role,
      isAdmin: currentUser?.role === 'admin',
      isPresident: currentUser?.role === 'president',
      hasAccess: currentUser?.role === 'admin' || currentUser?.role === 'president'
    });
    
    if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'president') {
      console.log('❌ 管理者権限がありません:', currentUser.role);
      toast.error('このページにアクセスする権限がありません');
      navigate('/');
    }
  }, [currentUser, navigate]);

  // 操作履歴を取得
  const fetchLogs = async () => {
    console.log('🔍 fetchLogs開始:', {
      currentUser: currentUser,
      role: currentUser?.role,
      hasAccess: currentUser?.role === 'admin' || currentUser?.role === 'president'
    });
    
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'president')) {
      console.log('❌ アクセス権限なし、fetchLogs終了');
      return;
    }

    setLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      console.log('📊 操作履歴取得開始:', { itemsPerPage, offset, currentPage });
      
      const [logsData, count] = await Promise.all([
        operationLogService.getOperationLogs(itemsPerPage, offset),
        operationLogService.getOperationLogsCount()
      ]);

      console.log('📊 取得結果:', { logsData, count, logsDataLength: logsData?.length });

      let filteredLogs = logsData;

      // フィルタリング
      if (filterType !== 'ALL') {
        filteredLogs = filteredLogs.filter(log => log.target_type === filterType);
      }
      if (filterOperation !== 'ALL') {
        filteredLogs = filteredLogs.filter(log => log.operation_type === filterOperation);
      }

      console.log('📊 フィルタリング後:', { filteredLogs, filteredLogsLength: filteredLogs?.length });

      setLogs(filteredLogs);
      setTotalCount(count);
    } catch (error) {
      console.error('操作履歴の取得に失敗しました:', error);
      toast.error('操作履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentUser, currentPage, filterType, filterOperation]);

  // CSVエクスポート
  const exportToCSV = () => {
    const csvContent = [
      ['日時', '操作者', '操作対象', '操作内容', '詳細'],
      ...logs.map(log => [
        new Date(log.created_at).toLocaleString('ja-JP'),
        log.operator_name,
        operationLogService.formatOperationLog(log).split('」を「')[0].split('「')[2],
        operationLogService.formatOperationLog(log).split('」を「')[1].split('」しました')[0],
        JSON.stringify(log.operation_details || {})
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `operation_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ページネーション
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'president')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                管理者メニューに戻る
              </button>
              <h1 className="text-3xl font-bold text-gray-900">操作履歴</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                更新
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV出力
              </button>
            </div>
          </div>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">フィルター:</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">対象:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="ALL">すべて</option>
                <option value="SCHEDULE">スケジュール</option>
                <option value="USER">ユーザー</option>
                <option value="ROOM">会議室</option>
                <option value="VEHICLE">車両</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">操作:</label>
              <select
                value={filterOperation}
                onChange={(e) => setFilterOperation(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="ALL">すべて</option>
                <option value="CREATE">作成</option>
                <option value="UPDATE">編集</option>
                <option value="DELETE">削除</option>
              </select>
            </div>
          </div>
        </div>

        {/* 統計情報 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
              <div className="text-sm text-gray-600">総操作数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {logs.filter(log => log.operation_type === 'CREATE').length}
              </div>
              <div className="text-sm text-gray-600">作成</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {logs.filter(log => log.operation_type === 'UPDATE').length}
              </div>
              <div className="text-sm text-gray-600">編集</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {logs.filter(log => log.operation_type === 'DELETE').length}
              </div>
              <div className="text-sm text-gray-600">削除</div>
            </div>
          </div>
        </div>

        {/* 操作履歴リスト */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">操作履歴一覧</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">読み込み中...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>操作履歴がありません</p>
              <p className="text-xs mt-2">デバッグ: loading={loading.toString()}, logs.length={logs.length}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {logs.map((log) => (
                <div key={log.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 leading-relaxed">
                        {operationLogService.formatOperationLog(log)}
                      </p>
                      {log.operation_details && (
                        <div className="mt-2 text-xs text-gray-500">
                          <details>
                            <summary className="cursor-pointer hover:text-gray-700">
                              詳細情報を表示
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                              {JSON.stringify(log.operation_details, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString('ja-JP')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {totalCount}件中 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalCount)}件を表示
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    前へ
                  </button>
                  <span className="px-3 py-1 text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    次へ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
