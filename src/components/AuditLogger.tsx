import { useState, useEffect } from 'react';
import { SecurityEvent } from '../types';
import { useSecurity } from '../contexts/SecurityContext';
import { usePermissions } from '../hooks/usePermissions';
import { formatSecurityEvent } from '../utils/security';

interface AuditLoggerProps {
  className?: string;
}

const SEVERITY_COLORS = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-yellow-600 bg-yellow-50',
  high: 'text-orange-600 bg-orange-50',
  critical: 'text-red-600 bg-red-50',
};

const EVENT_TYPE_ICONS = {
  login: '🔑',
  logout: '🚪',
  permission_denied: '🚫',
  data_access: '👁️',
  data_modification: '✏️',
  admin_action: '⚙️',
  security_violation: '⚠️',
};

export default function AuditLogger({ className = '' }: AuditLoggerProps) {
  const { getAuditLogs } = useSecurity();
  const { canViewAuditLogs } = usePermissions();
  const [auditLogs, setAuditLogs] = useState<SecurityEvent[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SecurityEvent[]>([]);
  const [filters, setFilters] = useState({
    type: 'all',
    severity: 'all',
    dateRange: '24h',
    user: '',
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(true);

  // Check permission
  if (!canViewAuditLogs()) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">アクセス権限がありません</h3>
          <p className="text-gray-500">監査ログを表示する権限がありません。</p>
        </div>
      </div>
    );
  }

  // Load audit logs
  useEffect(() => {
    setIsLoading(true);
    try {
      const logs = getAuditLogs();
      setAuditLogs(logs);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getAuditLogs]);

  // Apply filters
  useEffect(() => {
    let filtered = [...auditLogs];

    // Filter by event type
    if (filters.type !== 'all') {
      filtered = filtered.filter(log => log.type === filters.type);
    }

    // Filter by severity
    if (filters.severity !== 'all') {
      filtered = filtered.filter(log => log.severity === filters.severity);
    }

    // Filter by date range
    const now = new Date();
    let startDate: Date;
    switch (filters.dateRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }
    filtered = filtered.filter(log => log.timestamp >= startDate);

    // Filter by user
    if (filters.user) {
      const userFilter = filters.user.toLowerCase();
      filtered = filtered.filter(log => 
        log.userEmail.toLowerCase().includes(userFilter) ||
        log.userId.toLowerCase().includes(userFilter)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const timeA = a.timestamp.getTime();
      const timeB = b.timestamp.getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    setFilteredLogs(filtered);
  }, [auditLogs, filters, sortOrder]);

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'Type', 'User', 'Role', 'Action', 'Resource', 'Severity'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp.toISOString(),
        log.type,
        log.userEmail,
        log.userRole,
        log.action,
        log.resource || '',
        log.severity,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`bg-white ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">監査ログ</h2>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            エクスポート
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">イベントタイプ</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">すべて</option>
              <option value="login">ログイン</option>
              <option value="logout">ログアウト</option>
              <option value="permission_denied">権限拒否</option>
              <option value="data_access">データアクセス</option>
              <option value="data_modification">データ変更</option>
              <option value="admin_action">管理者操作</option>
              <option value="security_violation">セキュリティ違反</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">重要度</label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">すべて</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="critical">危険</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">期間</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="1h">過去1時間</option>
              <option value="24h">過去24時間</option>
              <option value="7d">過去7日</option>
              <option value="30d">過去30日</option>
              <option value="all">すべて</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ユーザー</label>
            <input
              type="text"
              value={filters.user}
              onChange={(e) => setFilters(prev => ({ ...prev, user: e.target.value }))}
              placeholder="ユーザー名またはメール"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            {filteredLogs.length}件のログが見つかりました
          </p>
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            時間順
            <svg className={`w-4 h-4 ml-1 transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">📝</div>
              <p className="text-gray-500">該当するログが見つかりません</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時刻</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイプ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ユーザー</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">重要度</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.timestamp.toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center">
                        <span className="mr-2">{EVENT_TYPE_ICONS[log.type]}</span>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{log.userEmail}</div>
                        <div className="text-gray-500 text-xs">{log.userRole}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={log.action}>
                        {log.action}
                      </div>
                      {log.resource && (
                        <div className="text-xs text-gray-500">
                          リソース: {log.resource}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${SEVERITY_COLORS[log.severity]}`}>
                        {log.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}