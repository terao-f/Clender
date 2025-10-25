import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { X, Edit, Trash2, Video, MapPin, Users, Clock, Calendar, AlertTriangle, Link as LinkIcon, Mail, Copy, Repeat } from 'lucide-react';
import { Schedule, User, Equipment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSecurity } from '../contexts/SecurityContext';
import { supabase } from '../lib/supabase';
import { mockUsers } from '../data/mockData';
import { getMeetingTypeDisplay, getMeetingTypeStyles } from '../utils/googleMeet';
import EmailSendModal from './EmailSendModal';
import { useConfirmation } from '../hooks/useConfirmation';
import ConfirmationModal from './ConfirmationModal';

interface ScheduleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  onEdit: () => void;
  onDelete: (deleteAllRecurring?: boolean) => void;
  onCopy?: () => void;
}

export default function ScheduleViewModal({ isOpen, onClose, schedule, onEdit, onDelete, onCopy }: ScheduleViewModalProps) {
  const { currentUser } = useAuth();
  const { canAccessResource } = useSecurity();
  const { confirm, confirmationState, handleConfirm, handleCancel } = useConfirmation();
  const [users, setUsers] = useState<User[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && schedule) {
      fetchData();
    }
  }, [isOpen, schedule]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name_kana');
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
        setUsers(mockUsers);
      } else {
        setUsers(usersData?.map(u => ({
          id: u.id,
          employeeId: u.employee_id,
          name: u.name,
          nameKana: u.name_kana,
          email: u.email,
          phone: u.phone,
          department: u.department,
          role: u.role,
          defaultWorkDays: u.default_work_days || []
        })) || []);
      }

      // Fetch equipment
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('equipment')
        .select('*')
        .order('name');
      
      if (equipmentError) {
        console.error('Error fetching equipment:', equipmentError);
      } else {
        setEquipment(equipmentData?.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type
        })) || []);
      }
      
      // Fetch schedule history
      if (schedule?.id) {
        const { data: historyData, error: historyError } = await supabase
          .from('schedule_history')
          .select('*')
          .eq('schedule_id', schedule.id)
          .order('operation_time', { ascending: false })
          .limit(5); // 最新5件のみ取得
        
        if (historyError) {
          console.error('Error fetching history:', historyError);
        } else {
          setHistory(historyData || []);
        }
      }

      // Fetch email history
      if (schedule?.id) {
        console.log('=== Fetching email history for schedule ===');
        console.log('Schedule ID:', schedule.id);
        console.log('Schedule meetLink:', schedule.meetLink);
        
        const { data: emailHistoryData, error: emailHistoryError } = await supabase
          .from('email_send_history')
          .select('*')
          .eq('schedule_id', schedule.id)
          .order('sent_at', { ascending: false });
        
        if (emailHistoryError) {
          console.error('Error fetching email history:', emailHistoryError);
        } else {
          console.log('Fetched email history:', emailHistoryData);
          console.log('Email history count:', emailHistoryData?.length || 0);
          setEmailHistory(emailHistoryData || []);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !schedule) return null;

  const participantNames = schedule.participants.map(pid => {
    const user = users.find(u => u.id === pid);
    return user?.name || pid;
  }).join('、');

  const equipmentNames = schedule.equipment?.map(eq => eq.name).join('、') || '';

  const createdByUser = users.find(u => u.id === schedule.createdBy);
  const canEdit = canAccessResource('schedule', 'write', schedule.createdBy);
  const canDelete = canAccessResource('schedule', 'delete', schedule.createdBy);
  
  // サンプル予約かどうかを判定
  const isSampleSchedule = schedule.type === 'サンプル作成' || 
    schedule.equipment?.some(eq => eq.type === 'sample');
  

  const getScheduleTypeStyles = (type: string) => {
    switch (type) {
      case '会議':
        return 'bg-blue-100 text-blue-800';
      case 'オンライン商談':
        return 'bg-purple-100 text-purple-800';
      case '来訪':
        return 'bg-amber-100 text-amber-800';
      case '工事':
        return 'bg-emerald-100 text-emerald-800';
      case '外出':
        return 'bg-yellow-100 text-yellow-800';
      case 'サンプル作成':
      case 'CAD・マーキング':
      case 'サンプル裁断':
      case 'サンプル縫製':
      case 'サンプル内職':
      case 'プレス':
      case '仕上げ・梱包':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[95vh] overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">予定の詳細</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(95vh-180px)]">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* タイトルとタイプ */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{schedule.title}</h3>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getScheduleTypeStyles(schedule.type)}`}>
                  {schedule.type}
                </span>
              </div>

              {/* 日時 */}
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">日時</p>
                  <p className="text-sm text-gray-600">
                    {(() => {
                      try {
                        const startDate = new Date(schedule.startTime);
                        const endDate = new Date(schedule.endTime);
                        
                        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                          return '日時情報が無効です';
                        }
                        
                        if (schedule.isMultiDay) {
                          return (
                            <>
                              {format(startDate, 'yyyy年M月d日 (E)', { locale: ja })} 〜{' '}
                              {format(endDate, 'yyyy年M月d日 (E)', { locale: ja })}
                            </>
                          );
                        } else {
                          return (
                            <>
                              {format(startDate, 'yyyy年M月d日 (E)', { locale: ja })}{' '}
                              {format(startDate, 'HH:mm')} -{' '}
                              {format(endDate, 'HH:mm')}
                            </>
                          );
                        }
                      } catch (error) {
                        console.error('Date formatting error:', error);
                        return '日時情報が無効です';
                      }
                    })()}
                  </p>
                  
                  {/* 繰り返し・複数日・終日・終了日情報 */}
                  <div className="mt-2 space-y-1">
                    {schedule.recurrence && (
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Repeat className="h-3 w-3 mr-1" />
                          繰り返し
                        </span>
                        <span className="text-xs text-gray-500">
                          {(() => {
                            const freq = schedule.recurrence.frequency;
                            const interval = schedule.recurrence.interval || 1;
                            const endType = schedule.recurrence.endType;
                            
                            let freqText = '';
                            switch (freq) {
                              case 'daily': freqText = '毎日'; break;
                              case 'weekly': freqText = '毎週'; break;
                              case 'monthly': freqText = '毎月'; break;
                              case 'yearly': freqText = '毎年'; break;
                              case 'weekdays': freqText = '平日'; break;
                              case 'custom': freqText = 'カスタム'; break;
                              default: freqText = freq;
                            }
                            
                            if (interval > 1) {
                              freqText = `${interval}${freqText}`;
                            }
                            
                            if (schedule.recurrence.endDate) {
                              return `${freqText} (${format(new Date(schedule.recurrence.endDate), 'yyyy年M月d日', { locale: ja })}まで)`;
                            } else {
                              return freqText;
                            }
                          })()}
                        </span>
                      </div>
                    )}
                    
                    {schedule.isMultiDay && (
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Calendar className="h-3 w-3 mr-1" />
                          複数日
                        </span>
                      </div>
                    )}
                    
                    {schedule.isAllDay && (
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <Clock className="h-3 w-3 mr-1" />
                          終日
                        </span>
                      </div>
                    )}
                    
                    {schedule.endDate && (
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          <Calendar className="h-3 w-3 mr-1" />
                          終了日: {format(new Date(schedule.endDate), 'yyyy年M月d日', { locale: ja })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 参加者 */}
              <div className="flex items-start space-x-3">
                <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">参加者</p>
                  <p className="text-sm text-gray-600">{participantNames || '参加者なし'}</p>
                </div>
              </div>

              {/* 場所 */}
              {schedule.location && (
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">場所</p>
                    <p className="text-sm text-gray-600">{schedule.location}</p>
                  </div>
                </div>
              )}

              {/* Google Meet */}
              {schedule.meetLink && (
                <div className="flex items-start space-x-3">
                  <Video className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Google Meet</p>
                    <div className="mt-1 flex items-center justify-between">
                      <div>
                        <a
                          href={schedule.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                        >
                          <LinkIcon className="h-4 w-4 mr-1" />
                          会議に参加
                        </a>
                        {schedule.meetingType && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({getMeetingTypeDisplay(schedule.meetingType)})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setIsEmailModalOpen(true)}
                        className="ml-4 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Mail className="h-3 w-3 inline mr-1" />
                        URL送信
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 設備 */}
              {equipmentNames && (
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">使用設備</p>
                    <p className="text-sm text-gray-600">{equipmentNames}</p>
                  </div>
                </div>
              )}

              {/* 詳細 - サンプル予約以外の場合のみ表示 */}
              {schedule.details && !isSampleSchedule && (
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">詳細</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{schedule.details}</p>
                  </div>
                </div>
              )}

              {/* 備考 */}
              {schedule.notes && (
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">備考</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{schedule.notes}</p>
                  </div>
                </div>
              )}




              {/* 作成者情報 */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  作成者: {createdByUser?.name || '不明'} 
                  {schedule.createdAt && (() => {
                    try {
                      const date = new Date(schedule.createdAt);
                      if (!isNaN(date.getTime())) {
                        return ` ・ 作成日時: ${format(date, 'yyyy年M月d日 HH:mm')}`;
                      }
                    } catch {}
                    return '';
                  })()}
                </p>
                {schedule.updatedAt && schedule.updatedAt !== schedule.createdAt && (() => {
                  try {
                    const date = new Date(schedule.updatedAt);
                    if (!isNaN(date.getTime())) {
                      return (
                        <p className="text-xs text-gray-500 mt-1">
                          最終更新: {format(date, 'yyyy年M月d日 HH:mm')}
                        </p>
                      );
                    }
                  } catch {}
                  return null;
                })()}
                
                {/* 操作履歴 */}
                {history.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-700 mb-2">操作履歴</p>
                    <div className="space-y-1">
                      {history.map((item, index) => {
                        const operator = users.find(u => u.id === item.operator_id);
                        const actionText = item.operation_type === 'create' ? '作成' : 
                                          item.operation_type === 'update' ? '編集' :
                                          item.operation_type === 'delete' ? '削除' : item.operation_type;
                        const timeStr = (() => {
                          try {
                            const date = new Date(item.operation_time);
                            if (!isNaN(date.getTime())) {
                              return format(date, 'yyyy年M月d日 HH:mm');
                            }
                          } catch {}
                          return '日時不明';
                        })();
                        
                        return (
                          <p key={index} className="text-xs text-gray-500">
                            {timeStr}：
                            {operator?.name || item.operator_name || '不明'}がスケジュールを{actionText}しました。
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                閉じる
              </button>
              {onCopy && (
                <button
                  onClick={() => {
                    onCopy();
                    onClose();
                  }}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50"
                >
                  <Copy className="h-4 w-4 inline mr-1" />
                  コピー
                </button>
              )}
            </div>
            {(canEdit || canDelete) && (
              <div className="flex space-x-3">
                {canEdit && (
                  <button
                    onClick={() => {
                      onEdit();
                      onClose();
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    <Edit className="h-4 w-4 inline mr-1" />
                    編集
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={async () => {
                      
                      // 繰り返し予約の場合は選択肢を提供
                      if (schedule.original_id || (schedule.recurrence && schedule.recurrence.frequency !== 'none')) {
                        const isRecurring = schedule.original_id || (schedule.recurrence && schedule.recurrence.frequency !== 'none');
                        
                        if (isRecurring) {
                          // 最初の確認モーダル：この予定のみ削除か、すべての繰り返し予定を削除か
                          const choice = await confirm({
                            title: '繰り返し予約の削除',
                            message: 'この予定は繰り返し予約です。\n\n「この予定のみを削除」: この予定のみを削除\n「すべての繰り返し予定を削除」: すべての繰り返し予定を削除\n\nどちらを実行しますか？',
                            confirmText: 'この予定のみを削除',
                            cancelText: 'すべての繰り返し予定を削除',
                            type: 'warning'
                          });
                          
                          if (choice) {
                            // この予定のみを削除
                            onDelete(false);
                          } else {
                            // すべての繰り返し予定を削除するか最終確認
                            const confirmAll = await confirm({
                              title: 'すべての繰り返し予定を削除',
                              message: `繰り返し予約「${schedule.title}」のすべてのインスタンスを削除しますか？\n\nこの操作は取り消せません。`,
                              confirmText: 'すべて削除',
                              cancelText: 'キャンセル',
                              type: 'danger'
                            });
                            
                            if (confirmAll) {
                              onDelete(true);
                            }
                          }
                        } else {
                          onDelete(false);
                        }
                      } else {
                        onDelete(false);
                      }
                      
                      onClose();
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4 inline mr-1" />
                    削除
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Google Meetメール送信履歴 */}
        {schedule?.meetLink && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="text-sm font-medium text-gray-700 mb-3">Google Meetメール送信履歴</div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(() => {
                const meetUrlHistory = emailHistory.filter(history => 
                  history.email_type === 'meet_url' || 
                  (history.body && history.body.includes(schedule.meetLink))
                );
                
                if (meetUrlHistory.length === 0) {
                  return (
                    <div className="text-xs text-gray-500 text-center py-4">
                      まだメールが送信されていません
                    </div>
                  );
                }
                
                return meetUrlHistory.map((history) => (
                  <div key={history.id} className="bg-blue-50 p-3 rounded-lg text-xs">
                    <div className="font-medium text-blue-900">
                      操作者名: {history.sender_name}
                    </div>
                    <div className="text-blue-700 mt-1">
                      操作日時: {format(new Date(history.sent_at), 'yyyy/MM/dd HH:mm')}
                    </div>
                    <div className="text-blue-600 mt-1">
                      送信先メールアドレス: {Array.isArray(history.recipient_emails) ? history.recipient_emails.join(', ') : '不明'}
                    </div>
                    <div className="text-blue-500 mt-1">
                      件名: {history.subject}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
        
        {/* メール送信モーダル */}
        <EmailSendModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          schedule={schedule}
          users={users}
        />
        
        {/* 確認モーダル */}
        <ConfirmationModal
          isOpen={confirmationState.isOpen}
          onClose={handleCancel}
          onConfirm={handleConfirm}
          title={confirmationState.title}
          message={confirmationState.message}
          confirmText={confirmationState.confirmText}
          cancelText={confirmationState.cancelText}
        />
      </div>
    </div>
  );
}