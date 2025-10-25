import React, { useState } from 'react';
import { X, Check, XCircle, User, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface LeaveApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  onApprovalComplete: () => void;
}

interface Approver {
  step: number;
  status: 'pending' | 'approved' | 'rejected';
  userId: string;
  userName: string;
  timestamp: string | null;
  proxyApprovedBy?: string;
  proxyApprovedByName?: string;
}

export default function LeaveApprovalModal({ 
  isOpen, 
  onClose, 
  request, 
  onApprovalComplete 
}: LeaveApprovalModalProps) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedApprover, setSelectedApprover] = useState<Approver | null>(null);
  const [showProxyApproval, setShowProxyApproval] = useState(false);
  const [isLeaveManager, setIsLeaveManager] = useState(false);

  // 休暇申請責任者の権限をチェック
  React.useEffect(() => {
    const checkLeaveManagerStatus = async () => {
      if (!currentUser?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('leave_manager_settings')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('is_active', true)
          .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error checking leave manager status:', error);
          return;
        }
        
        setIsLeaveManager(!!data || currentUser?.role === 'admin');
      } catch (error) {
        console.error('Error checking leave manager status:', error);
      }
    };

    checkLeaveManagerStatus();
  }, [currentUser]);

  if (!isOpen || !request) return null;

  const approvers: Approver[] = request.approvers || [];
  const pendingApprovers = approvers.filter(a => a.status === 'pending');

  const handleDirectApproval = async (approved: boolean) => {
    if (!currentUser?.id) return;
    
    setLoading(true);
    try {
      const updatedApprovers = approvers.map((approver: Approver) => {
        if (approver.userId === currentUser.id) {
          return {
            ...approver,
            status: approved ? 'approved' : 'rejected' as const,
            timestamp: new Date().toISOString(),
          };
        }
        return approver;
      });

      await updateLeaveRequest(updatedApprovers);
    } catch (error) {
      console.error('Error handling direct approval:', error);
      toast.error('承認処理に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleProxyApproval = async (approved: boolean) => {
    if (!currentUser?.id || !selectedApprover) return;
    
    setLoading(true);
    try {
      const updatedApprovers = approvers.map((approver: Approver) => {
        if (approver.userId === selectedApprover.userId) {
          return {
            ...approver,
            status: approved ? 'approved' : 'rejected' as const,
            timestamp: new Date().toISOString(),
            proxyApprovedBy: currentUser.id,
            proxyApprovedByName: currentUser.name,
          };
        }
        return approver;
      });

      await updateLeaveRequest(updatedApprovers);
      setShowProxyApproval(false);
      setSelectedApprover(null);
    } catch (error) {
      console.error('Error handling proxy approval:', error);
      toast.error('代理承認処理に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const updateLeaveRequest = async (updatedApprovers: Approver[]) => {
    // ワークフローの進行状況をチェック
    const step1Approvers = updatedApprovers.filter(a => a.step === 1);
    const step2Approvers = updatedApprovers.filter(a => a.step === 2);
    const step3Approvers = updatedApprovers.filter(a => a.step === 3);
    
    const step1AllApproved = step1Approvers.length > 0 && step1Approvers.every(a => a.status === 'approved');
    const step1AnyRejected = step1Approvers.some(a => a.status === 'rejected');
    const step2AllApproved = step2Approvers.length === 0 || step2Approvers.every(a => a.status === 'approved');
    const step2AnyRejected = step2Approvers.some(a => a.status === 'rejected');
    const step3AllApproved = step3Approvers.length === 0 || step3Approvers.every(a => a.status === 'approved');
    const step3AnyRejected = step3Approvers.some(a => a.status === 'rejected');

    let newStatus = 'pending';
    if (step1AnyRejected || step2AnyRejected || step3AnyRejected) {
      newStatus = 'rejected';
    } else if (step1AllApproved && step2AllApproved && step3AllApproved) {
      newStatus = 'approved';
    }

    const { error } = await supabase
      .from('leave_requests')
      .update({
        approvers: updatedApprovers,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', request.id);

    if (error) throw error;

    const action = updatedApprovers.find(a => a.userId === currentUser?.id || a.proxyApprovedBy === currentUser?.id)?.status === 'approved' ? '承認' : '却下';
    toast.success(`休暇申請を${action}しました`);
    onApprovalComplete();
    onClose();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return '承認済み';
      case 'rejected':
        return '却下';
      default:
        return '承認待ち';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-yellow-600 bg-yellow-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">休暇申請承認</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 申請情報 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">申請内容</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">申請者:</span>
                <span className="ml-2 font-medium">{request.userName}</span>
              </div>
              <div>
                <span className="text-gray-600">日付:</span>
                <span className="ml-2 font-medium">
                  {new Date(request.date).toLocaleDateString('ja-JP')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">種別:</span>
                <span className="ml-2 font-medium">{request.type}</span>
              </div>
              <div>
                <span className="text-gray-600">理由:</span>
                <span className="ml-2 font-medium">{request.reason}</span>
              </div>
            </div>
          </div>

          {/* 承認者一覧 */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">承認者一覧</h3>
            <div className="space-y-3">
              {approvers.map((approver, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(approver.status)}
                    <div>
                      <div className="font-medium">{approver.userName}</div>
                      {approver.proxyApprovedBy && (
                        <div className="text-xs text-gray-500">
                          代理承認: {approver.proxyApprovedByName}
                        </div>
                      )}
                      {approver.timestamp && (
                        <div className="text-xs text-gray-500">
                          {new Date(approver.timestamp).toLocaleString('ja-JP')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(approver.status)}`}>
                    {getStatusText(approver.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 承認ボタン */}
          {pendingApprovers.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="font-medium text-gray-900 mb-4">承認操作</h3>
              
              {/* 直接承認（自分の分のみ） */}
              {pendingApprovers.some(a => a.userId === currentUser?.id) && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-3">あなたの承認:</p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleDirectApproval(true)}
                      disabled={loading}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      <span>承認</span>
                    </button>
                    <button
                      onClick={() => handleDirectApproval(false)}
                      disabled={loading}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>却下</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 代理承認（休暇申請責任者のみ） */}
              {isLeaveManager && pendingApprovers.some(a => a.userId !== currentUser?.id) && (
                <div>
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">代理承認（休暇申請責任者）:</p>
                    <p className="text-xs text-gray-500 mt-1">
                      長期休職者など、承認者が不在の場合に代理で承認できます
                    </p>
                  </div>
                  <div className="space-y-2">
                    {pendingApprovers
                      .filter(a => a.userId !== currentUser?.id)
                      .map((approver, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">{approver.userName}</span>
                            <span className="text-sm text-gray-500">の代理で</span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedApprover(approver);
                                setShowProxyApproval(true);
                              }}
                              disabled={loading}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              代理承認
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 代理承認確認モーダル */}
          {showProxyApproval && selectedApprover && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {selectedApprover.userName}さんの代理承認
                </h3>
                <p className="text-gray-600 mb-6">
                  {selectedApprover.userName}さんの代わりに承認を行いますか？
                </p>
                <div className="flex space-x-3 justify-end">
                  <button
                    onClick={() => {
                      setShowProxyApproval(false);
                      setSelectedApprover(null);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => handleProxyApproval(false)}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    却下
                  </button>
                  <button
                    onClick={() => handleProxyApproval(true)}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    承認
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
