import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, getDay, isToday, isSameMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Video, AlertTriangle, Link as LinkIcon, Users, Mail, MailCheck } from 'lucide-react';
import { useCalendar } from '../../contexts/CalendarContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { mockUsers } from '../../data/mockData';
import { Schedule, User } from '../../types';
import { supabase } from '../../lib/supabase';
import ReservationModal from '../../components/ReservationModal';
import UserSelectionModal from '../../components/UserSelectionModal';
import ScheduleViewModal from '../../components/ScheduleViewModal';
import EmailSendModal from '../../components/EmailSendModal';
import ScheduleHistoryModal from '../../components/ScheduleHistoryModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { getMeetingTypeDisplay, getMeetingTypeStyles } from '../../utils/googleMeet';
import { getEmailSentStatuses } from '../../utils/emailTracking';
import { useConfirmation } from '../../hooks/useConfirmation';

export default function MyCalendar() {
  // v2.0.0 - 循環参照修正版
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const { confirm, confirmationState, handleConfirm, handleCancel } = useConfirmation();
  const { 
    currentDate, 
    view, 
    visibleUsers,
    setView, 
    goToNextPeriod, 
    goToPreviousPeriod, 
    goToToday,
    toggleUserVisibility,
    getSchedulesForDateRange,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    refreshSchedules
  } = useCalendar();

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [isUserSelectionModalOpen, setIsUserSelectionModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSchedule, setViewingSchedule] = useState<Schedule | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newlyCreatedSchedule, setNewlyCreatedSchedule] = useState<Schedule | null>(null);
  const [emailStatuses, setEmailStatuses] = useState<Record<string, boolean>>({});
  const [meetEmailSentStatuses, setMeetEmailSentStatuses] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; schedule: Schedule } | null>(null);
  const [copiedSchedule, setCopiedSchedule] = useState<Schedule | null>(null);

  // Load users from Supabase
  useEffect(() => {
    fetchUsers();
  }, []);

  // モバイルデバイスでの表示最適化（強制はしない）
  useEffect(() => {
    const checkMobileView = () => {
      const isMobile = window.innerWidth < 640; // Tailwindのsmブレークポイント
      // モバイルでは週表示を推奨するが、強制はしない
      if (isMobile && view === 'month') {
        // 月表示はモバイルでは見づらいため、週表示に変更を推奨
        console.log('モバイルでは週表示を推奨します');
      }
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, [view, setView]);

  // URLパラメータからスケジュールIDを取得して詳細を開く
  useEffect(() => {
    const scheduleId = searchParams.get('scheduleId');
    if (scheduleId && schedules.length > 0) {
      const targetSchedule = schedules.find(s => s.id === scheduleId);
      if (targetSchedule) {
        setViewingSchedule(targetSchedule);
        setIsViewModalOpen(true);
        // URLパラメータをクリア
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [searchParams, schedules]);

  // visibleUsersが変更されたらselectedUsersを同期
  useEffect(() => {
    console.log('MyCalendar - visibleUsers changed in useEffect:', visibleUsers);
    // visibleUsersをそのまま使用するため、selectedUsersへの同期を維持
    setSelectedUsers(visibleUsers);
  }, [visibleUsers]);

  // visibleUsersの順序でユーザーを取得する関数
  const getOrderedUsers = () => {
    console.log('MyCalendar - getOrderedUsers called');
    console.log('  - visibleUsers:', visibleUsers);
    console.log('  - users.length:', users.length);
    
    // visibleUsersが空または未設定の場合は全ユーザーを返す
    if (!visibleUsers || visibleUsers.length === 0) {
      console.log('  - Returning all users (no visibleUsers set)');
      return users;
    }
    
    // visibleUsersの順序に従ってユーザーを並び替える
    const orderedUsers = visibleUsers
      .map(userId => {
        const user = users.find(u => u.id === userId);
        if (!user) {
          console.log(`  - User not found for ID: ${userId}`);
        }
        return user;
      })
      .filter(Boolean) as User[];
    
    console.log('  - Ordered users:', orderedUsers.map(u => u.name));
    
    return orderedUsers;
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*');
      
      if (error) {
        console.error('Error fetching users:', error);
        setUsers(mockUsers);
      } else {
        const convertedUsers: User[] = data?.map(u => ({
          id: u.id,
          employeeId: u.employee_id,
          name: u.name,
          nameKana: u.name_kana,
          email: u.email,
          phone: u.phone,
          department: u.department,
          role: u.role,
          defaultWorkDays: u.default_work_days || []
        })) || [];
        
        // ソートせずにそのまま保存（visibleUsersの順序を優先するため）
        setUsers(convertedUsers);
        
        console.log('Fetched users:', convertedUsers.map(u => ({ id: u.id, name: u.name })));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  };

  // Get dates based on view
  const getDatesForView = () => {
    switch (view) {
      case 'day':
        return [currentDate];
      case 'week':
        // 週表示: 今日を一番左に来るように7日間を表示
        return Array.from({ length: 7 }, (_, i) => addDays(currentDate, i));
      case 'month':
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDateMonth = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDateMonth = addDays(startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 }), 6);
        return eachDayOfInterval({ start: startDateMonth, end: endDateMonth });
      default:
        return [];
    }
  };

  const days = getDatesForView();
  
  // Get schedules for the current period
  const schedules = days.length > 0 ? getSchedulesForDateRange(
    days[0],
    addDays(days[days.length - 1], 1)
  ) : [];
  
  // デバッグ: 週表示でのスケジュール取得を確認
  if (view === 'week') {
    console.log('📅 週表示 - 取得したスケジュール数:', schedules.length);
    console.log('📅 週表示 - 日付範囲:', days[0]?.toISOString(), '〜', days[days.length - 1]?.toISOString());
    schedules.forEach(schedule => {
      console.log(`📅 スケジュール: ${schedule.title} (${schedule.startTime.toISOString()}) - original_id: ${schedule.original_id} - recurrence: ${schedule.recurrence ? 'あり' : 'なし'}`);
    });
  }
  
  // メール送信状態を取得
  useEffect(() => {
    if (schedules.length > 0) {
      const scheduleIds = schedules.map(s => s.id);
      const statuses = getEmailSentStatuses(scheduleIds);
      setEmailStatuses(statuses);
      
      // Google Meet URLメール送信状態を取得
      fetchMeetEmailStatuses(schedules);
    }
  }, [schedules.length]);

  // Google Meet URLメールの送信状態を取得
  const fetchMeetEmailStatuses = async (scheduleList: Schedule[]) => {
    try {
      const meetSchedules = scheduleList.filter(s => s.meetLink);
      if (meetSchedules.length === 0) return;
      
      const { data, error } = await supabase
        .from('email_send_history')
        .select('schedule_id')
        .in('schedule_id', meetSchedules.map(s => s.id))
        .eq('email_type', 'meet_url');
      
      if (!error && data) {
        const statuses: Record<string, boolean> = {};
        data.forEach(item => {
          statuses[item.schedule_id] = true;
        });
        setMeetEmailSentStatuses(statuses);
      }
    } catch (error) {
      console.error('Error fetching meet email statuses:', error);
    }
  };

  const toggleUser = (userId: string) => {
    const newSelectedUsers = selectedUsers.includes(userId) 
      ? selectedUsers.filter(id => id !== userId)
      : [...selectedUsers, userId];
    
    setSelectedUsers(newSelectedUsers);
    toggleUserVisibility(newSelectedUsers);
  };

  const toggleAllUsers = () => {
    const newSelectedUsers = selectedUsers.length === users.length ? [] : users.map(user => user.id);
    setSelectedUsers(newSelectedUsers);
    toggleUserVisibility(newSelectedUsers);
  };

  const handleUsersChange = (newSelectedUsers: string[]) => {
    console.log('MyCalendar - handleUsersChange called');
    console.log('  - newSelectedUsers:', newSelectedUsers);
    console.log('  - newSelectedUsers names:', newSelectedUsers.map(id => {
      const user = users.find(u => u.id === id);
      return user ? user.name : 'Unknown';
    }));
    setSelectedUsers(newSelectedUsers);
    // CalendarContextにtoggleUserVisibilityに配列を直接渡す
    toggleUserVisibility(newSelectedUsers);
  };

  // Handle cell click to create new schedule with pre-filled date and participant
  const handleCellClick = (date: Date, userId?: string) => {
    setSelectedDate(date);
    setSelectedParticipant(userId || null);
    setEditingSchedule(null);
    setIsModalOpen(true);
  };

  const getUserSchedulesForDay = (userId: string, date: Date) => {
    // シンプルな予定表示ロジック：DBにある予定データをその日の日付の予定に表示
    return schedules.filter(schedule => {
      // 1. ユーザーが参加者かチェック（Google Calendar予定の場合は作成者もOK）
      const isParticipant = schedule.participants?.includes(userId) || 
                           (schedule.is_from_google_calendar && schedule.created_by === userId);
      
      // 2. 参加者のみ表示（作成者で参加者でない場合は表示しない）
      if (!isParticipant) {
        return false; // 参加者でない場合は表示しない
      }
      
      // 3. 日付マッチング：その日の予定かチェック
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);
      const targetDate = new Date(date);
      
      // 日付のみで比較（時刻は無視）
      const scheduleStartDate = new Date(scheduleStart.getFullYear(), scheduleStart.getMonth(), scheduleStart.getDate());
      const scheduleEndDate = new Date(scheduleEnd.getFullYear(), scheduleEnd.getMonth(), scheduleEnd.getDate());
      const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      
      // 予定の期間内にその日が含まれているかチェック
      const dateMatch = targetDateOnly >= scheduleStartDate && targetDateOnly <= scheduleEndDate;
      
      return isParticipant && dateMatch;
    }).sort((a, b) => {
      // 終日予定を最優先（一番上）
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      
      // 終日予定同士の場合は開始時間でソート
      if (a.isAllDay && b.isAllDay) {
        return a.startTime.getTime() - b.startTime.getTime();
      }
      
      // 通常予定は開始時間で時系列ソート
      return a.startTime.getTime() - b.startTime.getTime();
    });
  };

  // スケジュールが特定の日で開始するかチェック
  const isScheduleStartingOnDate = (schedule: Schedule, date: Date): boolean => {
    const scheduleStart = new Date(schedule.startTime);
    const targetDate = new Date(date);
    
    scheduleStart.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    
    return scheduleStart.getTime() === targetDate.getTime();
  };
  
  // スケジュールが何日間続くか計算
  const getScheduleDuration = (schedule: Schedule): number => {
    const start = new Date(schedule.startTime);
    const end = new Date(schedule.endTime);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays + 1; // 開始日を含む
  };
  
  // スケジュールが特定の日で何日目かを計算
  const getScheduleDayPosition = (schedule: Schedule, date: Date): number => {
    const start = new Date(schedule.startTime);
    const targetDate = new Date(date);
    
    start.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays + 1; // 1ベースで返す
  };

  // スケジュールの背景色を取得する関数
  const getScheduleColorClasses = (schedule: Schedule): string => {
    // 会議室予約カテゴリーのスケジュールで、meetingTypeが設定されている場合
    const meetingRoomTypes = ['会議', '打ち合わせ', '面接', '研修', 'プレゼン'];
    if (meetingRoomTypes.includes(schedule.type) && schedule.meetingType) {
      if (schedule.meetingType === 'online') {
        return 'bg-purple-100 text-purple-800 border-purple-200';
      } else {
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      }
    }
    
    // その他のタイプは従来通り
    switch (schedule.type) {
      case '会議':
      case '打ち合わせ':
      case '面接':
      case '研修':
      case 'プレゼン':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'; // デフォルトは対面（緑）
      case 'オンライン商談':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case '来訪':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case '工事':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case '外出':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'サンプル作成':
      case 'CAD・マーキング':
      case 'サンプル裁断':
      case 'サンプル縫製':
      case 'サンプル内職':
      case 'プレス':
      case '仕上げ・梱包':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // 重複スケジュールをチェックする関数
  const hasConflictingSchedules = (schedule: Schedule, allSchedules: Schedule[]) => {
    const scheduleStart = new Date(schedule.startTime);
    const scheduleEnd = new Date(schedule.endTime);
    
    return allSchedules.some(otherSchedule => {
      if (otherSchedule.id === schedule.id) return false;
      
      const otherStart = new Date(otherSchedule.startTime);
      const otherEnd = new Date(otherSchedule.endTime);
      
      // 参加者が重複しているかチェック
      const hasCommonParticipants = schedule.participants.some(participant =>
        otherSchedule.participants.includes(participant)
      );
      
      if (!hasCommonParticipants) return false;
      
      // 時間が重複しているかチェック
      return (scheduleStart < otherEnd && scheduleEnd > otherStart);
    });
  };

  // Render calendar based on view
  const renderCalendarContent = () => {
    if (view === 'month') {
      return renderMonthView();
    } else {
      return renderWeekDayView();
    }
  };

  const renderMonthView = () => {
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div className="bg-white overflow-visible">
        {/* Month header */}
        <div className="grid grid-cols-7 border-b border-gray-300 bg-gray-50">
          {['月', '火', '水', '木', '金', '土', '日'].map((day, i) => (
            <div key={i} className="px-1 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase">
              {day}
            </div>
          ))}
        </div>
        
        {/* Month body */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-300">
            {week.map((date, dayIndex) => {
              const isCurrentMonth = isSameMonth(date, currentDate);
              const daySchedules = selectedUsers.flatMap(userId => 
                getUserSchedulesForDay(userId, date)
              );
              
              return (
                <div 
                  key={dayIndex} 
                  className={`min-h-[80px] sm:min-h-[120px] p-1 sm:p-2 border-r border-gray-300 overflow-visible ${
                    !isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
                  }`}
                  onClick={() => handleCellClick(date)}
                >
                  <div className={`text-xs sm:text-sm font-medium mb-1 ${
                    isToday(date) ? 'bg-blue-100 text-blue-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center' : ''
                  }`}>
                    {format(date, 'd')}
                  </div>
                  <div className="space-y-1.5 relative">
                    {daySchedules.slice(0, 3).map((schedule, index) => {
                      const user = users.find(u => 
                        schedule.participants.includes(u.id) || schedule.createdBy === u.id
                      );
                      const hasConflict = hasConflictingSchedules(schedule, schedules);
                      const isStartDay = isScheduleStartingOnDate(schedule, date);
                      const dayPosition = getScheduleDayPosition(schedule, date);
                      const duration = getScheduleDuration(schedule);
                      
                      return (
                        <div 
                          key={`month-${schedule.id}-${date.toISOString()}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingSchedule(schedule);
                            setIsViewModalOpen(true);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // 画面内に収まるように調整
                            const x = Math.min(e.clientX, window.innerWidth - 200);
                            const y = Math.min(e.clientY, window.innerHeight - 150);
                            setContextMenu({ x, y, schedule });
                          }}
                          className={`group/schedule relative isolate px-2 py-1.5 rounded border cursor-pointer hover:opacity-80 hover:z-50 hover:shadow-md transition-all ${getScheduleColorClasses(schedule)}`}
                        >
                          {schedule.isMultiDay && !isStartDay ? (
                            // 継続日の簡略表示
                            <div className="flex items-center space-x-1">
                              <div className="text-[10px] font-medium text-gray-600">
                                ← 継続 ({dayPosition}/{duration}日目)
                              </div>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white bg-opacity-80">
                                {schedule.type}
                              </span>
                            </div>
                          ) : (
                            // 開始日または単日の通常表示
                            <div className="flex flex-col items-center space-y-0.5">
                              <div className="flex items-center space-x-1">
                                <CalendarIcon className="h-3 w-3 text-gray-600" />
                                {hasConflict && (
                                  <AlertTriangle className="h-3 w-3 text-red-600" />
                                )}
                                {schedule.meetLink && (
                                  <>
                                    <Video className="h-3 w-3 text-gray-600" />
                                    {meetEmailSentStatuses[schedule.id] ? (
                                      <Mail className="h-3 w-3 text-red-600" title="Google Meet URLメール送信済み" />
                                    ) : emailStatuses[schedule.id] ? (
                                      <MailCheck className="h-3 w-3 text-green-600" title="メール送信済み" />
                                    ) : (
                                      <Mail className="h-3 w-3 text-gray-400" title="メール未送信" />
                                    )}
                                  </>
                                )}
                                {schedule.isMultiDay && (
                                  <span className="text-[9px] font-medium text-gray-600">
                                    ({duration}日間)
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-medium text-gray-800">
                                {schedule.isAllDay
                                  ? '終日'
                                  : schedule.isMultiDay 
                                    ? `${format(schedule.startTime, 'M/d')}〜${format(schedule.endTime, 'M/d')}`
                                    : `${format(schedule.startTime, 'HH:mm')}～${format(schedule.endTime, 'HH:mm')}`
                                }
                              </div>
                              <div className="flex items-center">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white bg-opacity-80">
                                  {schedule.type}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* ホバー時の詳細情報 */}
                          <div 
                            className="absolute bg-gray-900 text-white p-3 rounded shadow-lg opacity-0 group-hover/schedule:opacity-100 transition-opacity duration-200 z-[9999] w-72 pointer-events-none max-h-64 overflow-y-auto"
                            style={{
                              top: weekIndex >= 3 ? 'auto' : '100%',
                              bottom: weekIndex >= 3 ? '100%' : 'auto',
                              marginTop: weekIndex >= 3 ? '0' : '4px',
                              marginBottom: weekIndex >= 3 ? '4px' : '0',
                              left: dayIndex >= 5 ? 'auto' : '50%',
                              right: dayIndex >= 5 ? '0' : 'auto',
                              transform: dayIndex >= 5 ? 'none' : 'translateX(-50%)'
                            }}
                          >
                            <div className="font-medium mb-2 text-sm">{schedule.title}</div>
                            <div className="text-xs space-y-1">
                              <div>時間: {schedule.isAllDay ? '終日' : `${format(schedule.startTime, 'HH:mm')} - ${format(schedule.endTime, 'HH:mm')}`}</div>
                              <div>
                                <span className="font-medium">参加者: </span>
                                <span className="text-xs">
                                  {schedule.participants
                                    .filter(pid => pid !== schedule.createdBy)
                                    .map(pid => {
                                      const participantUser = users.find(u => u.id === pid);
                                      return participantUser ? `${participantUser.name}` : pid;
                                    }).join(', ')}
                                </span>
                              </div>
                              {schedule.equipment?.length > 0 && (
                                <div>設備: {schedule.equipment.map(eq => eq.name).join(', ')}</div>
                              )}
                              {schedule.meetLink && (
                                <div className="flex items-center space-x-1">
                                  <span>Google Meet</span>
                                  {schedule.meetingType && (
                                    <span className="ml-1">({getMeetingTypeDisplay(schedule.meetingType)})</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {daySchedules.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{daySchedules.length - 3}件
                      </div>
                    )}
                    {daySchedules.length >= 10 && (
                      <div className="text-xs text-red-600 font-medium">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        上限達成
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekDayView = () => {
    return (
      <div className="bg-white overflow-visible">

        {/* Mobile view for week/day */}
        <div className="sm:hidden">
          {getOrderedUsers().map(user => {
            const userId = user.id;
            return (
              <div key={userId} className="border-b border-gray-300">
                <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                  {user.name} <span className="text-xs text-gray-500">({user.department})</span>
                </div>
                <div className="divide-y divide-gray-300">
                  {days.map((date, i) => {
                    const daySchedules = getUserSchedulesForDay(userId, date);
                    return (
                      <div key={i} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-gray-900">
                            {format(date, 'M月d日 (E)', { locale: ja })}
                          </div>
                          <button
                            onClick={() => handleCellClick(date, userId)}
                            className="bg-blue-100 rounded-full p-1 hover:bg-blue-200"
                          >
                            <Plus className="h-3 w-3 text-blue-600" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {daySchedules.length === 0 ? (
                            <div className="text-xs text-gray-500">予定なし</div>
                          ) : (
                            daySchedules.map(schedule => {
                              const hasConflict = hasConflictingSchedules(schedule, schedules);
                              const isStartDay = isScheduleStartingOnDate(schedule, date);
                              const dayPosition = getScheduleDayPosition(schedule, date);
                              const duration = getScheduleDuration(schedule);
                              
                              return (
                                <div 
                                  key={`week-${schedule.id}-${date.toISOString()}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingSchedule(schedule);
                                    setIsViewModalOpen(true);
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const x = Math.min(e.clientX, window.innerWidth - 200);
                                    const y = Math.min(e.clientY, window.innerHeight - 150);
                                    setContextMenu({ x, y, schedule });
                                  }}
                                  className={`group relative isolate px-3 py-2 rounded cursor-pointer hover:z-50 ${getScheduleColorClasses(schedule).replace(/ border-\S+/g, '')}`}
                                >
                                  {schedule.isMultiDay && !isStartDay ? (
                                    // 継続日の簡略表示
                                    <div className="flex items-center space-x-2">
                                      <div className="text-sm font-medium text-gray-600">
                                        ← 継続 ({dayPosition}/{duration}日目)
                                      </div>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-white bg-opacity-80">
                                        {schedule.type}
                                      </span>
                                    </div>
                                  ) : (
                                    // 開始日または単日の通常表示
                                    <div className="flex flex-col items-start space-y-1">
                                      <div className="flex items-center space-x-1">
                                        <CalendarIcon className="h-4 w-4 text-gray-600" />
                                        {hasConflict && (
                                          <AlertTriangle className="h-3 w-3 text-red-600" />
                                        )}
                                        {schedule.meetLink && (
                                          <>
                                            <Video className="h-3 w-3 text-gray-600" />
                                            {emailStatuses[schedule.id] ? (
                                              <MailCheck className="h-3 w-3 text-green-600" title="メール送信済み" />
                                            ) : (
                                              <Mail className="h-3 w-3 text-gray-400" title="メール未送信" />
                                            )}
                                          </>
                                        )}
                                        {schedule.isMultiDay && (
                                          <span className="text-xs font-medium text-gray-600">
                                            ({duration}日間)
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm font-medium text-gray-800">
                                        {schedule.isAllDay
                                          ? '終日'
                                          : schedule.isMultiDay 
                                            ? `${format(schedule.startTime, 'M/d')}〜${format(schedule.endTime, 'M/d')}`
                                            : `${format(schedule.startTime, 'HH:mm')}～${format(schedule.endTime, 'HH:mm')}`
                                        }
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-white bg-opacity-80">
                                          {schedule.type}
                                        </span>
                                        <span className="text-xs text-gray-700 truncate">{schedule.title}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop view for week/day */}
        <div className="hidden sm:block overflow-x-auto border border-gray-300 rounded-lg">
          <table className={`divide-y divide-gray-300 w-full ${view === 'week' ? 'table-auto' : ''}`}>
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10" style={{ minWidth: '100px', maxWidth: '120px' }}>
                  利用者
                </th>
                {days.map((date, i) => (
                  <th key={i} scope="col" className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: view === 'week' ? '120px' : 'auto' }}>
                    <div className="flex flex-col items-center">
                      <span>{format(date, view === 'day' ? 'yyyy年M月d日 EEEE' : 'EEEE', { locale: ja })}</span>
                      {view !== 'day' && (
                        <span className={`mt-1 text-sm ${isToday(date) ? 'bg-blue-100 text-blue-800 rounded-full w-7 h-7 flex items-center justify-center' : ''}`}>
                          {format(date, 'd')}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-300">
              {getOrderedUsers().map((user, userIndex) => {
                const userId = user.id;
                
                // 各日の予定数を計算して最大の行高を決定
                const maxSchedulesInDay = Math.max(
                  ...days.map(date => getUserSchedulesForDay(userId, date).length),
                  1
                );
                const minHeight = `${Math.max(100, maxSchedulesInDay * 45)}px`;
                
                return (
                  <tr key={userId}>
                    <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-300" style={{ minWidth: '100px', maxWidth: '120px' }}>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.department}</div>
                        </div>
                        {user.isHr && (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                            人事
                          </span>
                        )}
                      </div>
                    </td>
                    {days.map((date, i) => {
                      const daySchedules = getUserSchedulesForDay(userId, date);
                      return (
                        <td key={i} className="px-1 py-1 text-sm text-gray-500 relative border border-gray-200 align-top" style={{ minHeight, minWidth: view === 'week' ? '120px' : 'auto' }}>
                          <button
                            onClick={() => handleCellClick(date, userId)}
                            className="absolute top-1 right-1 opacity-0 hover:opacity-100 transition-opacity duration-200 bg-blue-100 rounded-full p-1 hover:bg-blue-200 z-10"
                          >
                            <Plus className="h-3 w-3 text-blue-600" />
                          </button>
                          <div className="space-y-1 relative w-full">
                            {daySchedules.map((schedule, index) => {
                              const hasConflict = hasConflictingSchedules(schedule, schedules);
                              const isStartDay = isScheduleStartingOnDate(schedule, date);
                              const dayPosition = getScheduleDayPosition(schedule, date);
                              const duration = getScheduleDuration(schedule);
                              
                              return (
                                <div 
                                  key={`day-${schedule.id}-${date.toISOString()}-${index}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingSchedule(schedule);
                                    setIsViewModalOpen(true);
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const x = Math.min(e.clientX, window.innerWidth - 200);
                                    const y = Math.min(e.clientY, window.innerHeight - 150);
                                    setContextMenu({ x, y, schedule });
                                  }}
                                  className={`group/schedule relative px-1 py-0.5 rounded-sm border cursor-pointer hover:opacity-90 transition-all text-[8px] ${getScheduleColorClasses(schedule)}`}
                                >
                                  {schedule.isMultiDay && !isStartDay ? (
                                    // 継続日の簡略表示
                                    <div className="w-full">
                                      <div className="text-[10px] font-medium text-gray-600 truncate">
                                        ← 継続 ({dayPosition}/{duration})
                                      </div>
                                      <div className="flex items-center space-x-1 w-full">
                                        <span className="inline-flex items-center px-1 py-0 rounded text-[9px] font-semibold bg-white bg-opacity-70 flex-shrink-0">
                                          {schedule.type}
                                        </span>
                                        <span className="text-[9px] text-gray-700 truncate block overflow-hidden">{schedule.title}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    // 開始日または単日の通常表示
                                    <div className="w-full">
                                      <div className="flex items-center space-x-1">
                                        <div className="flex items-center flex-shrink-0">
                                          {hasConflict && (
                                            <AlertTriangle className="h-3 w-3 text-red-600" />
                                          )}
                                          {schedule.meetLink && (
                                            <>
                                              <Video className="h-3 w-3 text-blue-600" />
                                              {meetEmailSentStatuses[schedule.id] && (
                                                <Mail className="h-3 w-3 text-red-600" title="Google Meet URLメール送信済み" />
                                              )}
                                            </>
                                          )}
                                        </div>
                                        <div className="text-[9px] font-medium text-gray-800 flex-shrink-0">
                                          {schedule.isAllDay
                                            ? '終日'
                                            : `${format(schedule.startTime, 'HH:mm')}-${format(schedule.endTime, 'HH:mm')}`
                                          }
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-1 mt-0.5 w-full">
                                        <span className="inline-flex items-center px-1 py-0 rounded text-[8px] font-semibold bg-white bg-opacity-70 flex-shrink-0">
                                          {schedule.type}
                                        </span>
                                        <span className="text-[9px] text-gray-700 truncate block overflow-hidden">{schedule.title}</span>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* ホバー時の詳細情報 */}
                                  <div 
                                    className="hidden absolute bg-gray-900 text-white p-3 rounded shadow-lg opacity-0 group-hover/schedule:block group-hover/schedule:opacity-100 transition-opacity duration-200 z-[9999] w-64 pointer-events-none max-h-48 overflow-y-auto"
                                    style={{
                                      top: userIndex >= Math.floor(getOrderedUsers().length / 2) ? 'auto' : '100%',
                                      bottom: userIndex >= Math.floor(getOrderedUsers().length / 2) ? '100%' : 'auto',
                                      marginTop: userIndex >= Math.floor(getOrderedUsers().length / 2) ? '0' : '4px',
                                      marginBottom: userIndex >= Math.floor(getOrderedUsers().length / 2) ? '4px' : '0',
                                      left: i >= (view === 'week' ? 5 : 0) ? 'auto' : '50%',
                                      right: i >= (view === 'week' ? 5 : 0) ? '0' : 'auto',
                                      transform: i >= (view === 'week' ? 5 : 0) ? 'none' : 'translateX(-50%)'
                                    }}
                                  >
                                    <div className="font-medium mb-2 text-sm">{schedule.title}</div>
                                    <div className="text-xs space-y-1">
                                      <div>時間: {schedule.isAllDay ? '終日' : `${format(schedule.startTime, 'HH:mm')} - ${format(schedule.endTime, 'HH:mm')}`}</div>
                                      <div>
                                        <span className="font-medium">参加者: </span>
                                        <span className="text-xs">
                                          {schedule.participants
                                            .filter(pid => pid !== schedule.createdBy)
                                            .map(pid => {
                                              const participantUser = users.find(u => u.id === pid);
                                              return participantUser ? `${participantUser.name}` : pid;
                                            }).join(', ')}
                                        </span>
                                      </div>
                                      {schedule.equipment?.length > 0 && (
                                        <div>設備: {schedule.equipment.map(eq => eq.name).join(', ')}</div>
                                      )}
                                      {schedule.meetLink && (
                                        <div className="flex items-center space-x-1">
                                          <span>Google Meet</span>
                                          {schedule.meetingType && (
                                            <span className="ml-1">({getMeetingTypeDisplay(schedule.meetingType)})</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">マイカレンダー</h1>
        <button
          onClick={() => {
            setEditingSchedule(null);
            setSelectedDate(null);
            setSelectedParticipant(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-5 w-5 mr-1" />
          予定作成
        </button>
      </div>

      <div className="bg-white shadow rounded-lg mx-[-1rem] px-8">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex items-center justify-between flex-wrap sm:flex-nowrap">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {format(currentDate, 'yyyy年M月', { locale: ja })}
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              {/* モバイルでは週表示のみ、デスクトップでは全表示 */}
              <div className="hidden sm:inline-flex shadow-sm rounded-md">
                <button
                  type="button"
                  onClick={() => setView('day')}
                  className={`relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                    view === 'day' ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  日
                </button>
                <button
                  type="button"
                  onClick={() => setView('week')}
                  className={`relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium ${
                    view === 'week' ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  週
                </button>
                <button
                  type="button"
                  onClick={() => setView('month')}
                  className={`relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                    view === 'month' ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  月
                </button>
              </div>
              {/* モバイル用：日・週・月切り替え */}
              <div className="sm:hidden inline-flex shadow-sm rounded-md">
                <button
                  type="button"
                  onClick={() => setView('day')}
                  className={`relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-xs font-medium ${
                    view === 'day' ? 'text-blue-600 z-10 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  日
                </button>
                <button
                  type="button"
                  onClick={() => setView('week')}
                  className={`relative inline-flex items-center px-3 py-2 border-t border-b border-gray-300 bg-white text-xs font-medium ${
                    view === 'week' ? 'text-blue-600 z-10 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  週
                </button>
                <button
                  type="button"
                  onClick={() => setView('month')}
                  className={`relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-xs font-medium ${
                    view === 'month' ? 'text-blue-600 z-10 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  月
                </button>
              </div>
              <div className="inline-flex rounded-md shadow-sm">
                <button
                  type="button"
                  onClick={goToPreviousPeriod}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">前へ</span>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  今日
                </button>
                <button
                  type="button"
                  onClick={goToNextPeriod}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">次へ</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={() => setIsUserSelectionModalOpen(true)}
                className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Users className="h-3 sm:h-4 w-3 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">表示ユーザー</span>
                <span className="sm:hidden">表示</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 overflow-visible">
          {/* Left sidebar - User selection (非表示) */}
          <div className="hidden w-60 border-r border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center mb-3">
              <input
                id="select-all"
                name="select-all"
                type="checkbox"
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                checked={selectedUsers.length === users.length && users.length > 0}
                onChange={toggleAllUsers}
              />
              <label htmlFor="select-all" className="ml-2 block text-sm text-gray-900 font-semibold">
                全員を表示
              </label>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-auto">
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                </div>
              ) : (
                // Sort users: selected users first, then unselected users, both groups sorted by Japanese alphabetical order
                [...users]
                  .sort((a, b) => {
                    const aSelected = selectedUsers.includes(a.id);
                    const bSelected = selectedUsers.includes(b.id);
                    
                    // If one is selected and other is not, selected comes first
                    if (aSelected && !bSelected) return -1;
                    if (!aSelected && bSelected) return 1;
                    
                    // If both have same selection status, sort by name in Japanese alphabetical order
                    const aName = a.nameKana || a.name;
                    const bName = b.nameKana || b.name;
                    return aName.localeCompare(bName, 'ja', { sensitivity: 'base', numeric: true });
                  })
                  .map(user => (
                    <div key={user.id} className="flex items-center">
                      <input
                        id={`user-${user.id}`}
                        name={`user-${user.id}`}
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                      />
                      <label htmlFor={`user-${user.id}`} className="ml-2 block text-sm text-gray-700">
                        {user.name}
                        <span className="ml-1 text-xs text-gray-500">({user.department})</span>
                      </label>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Mobile user selector (非表示) */}
          <div className="hidden border-b border-gray-200 bg-gray-50 p-3">
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-900">
                  表示ユーザー ({selectedUsers.length}名)
                </span>
                <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </summary>
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                <div className="flex items-center mb-2">
                  <input
                    id="select-all-mobile"
                    name="select-all-mobile"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={selectedUsers.length === users.length && users.length > 0}
                    onChange={toggleAllUsers}
                  />
                  <label htmlFor="select-all-mobile" className="ml-2 block text-sm text-gray-900 font-semibold">
                    全員を表示
                  </label>
                </div>
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                  </div>
                ) : (
                  [...users]
                    .sort((a, b) => {
                      const aSelected = selectedUsers.includes(a.id);
                      const bSelected = selectedUsers.includes(b.id);
                      
                      if (aSelected && !bSelected) return -1;
                      if (!aSelected && bSelected) return 1;
                      
                      const aName = a.nameKana || a.name;
                      const bName = b.nameKana || b.name;
                      return aName.localeCompare(bName, 'ja', { sensitivity: 'base', numeric: true });
                    })
                    .map(user => (
                      <div key={user.id} className="flex items-center">
                        <input
                          id={`user-mobile-${user.id}`}
                          name={`user-mobile-${user.id}`}
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUser(user.id)}
                        />
                        <label htmlFor={`user-mobile-${user.id}`} className="ml-2 block text-sm text-gray-700">
                          {user.name}
                          <span className="ml-1 text-xs text-gray-500">({user.department})</span>
                        </label>
                      </div>
                    ))
                )}
              </div>
            </details>
          </div>

          {/* Main calendar content */}
          <div className="flex-1 overflow-hidden w-full">
            {renderCalendarContent()}
          </div>
        </div>
      </div>
      
      {/* Context Menu - Portal */}
      {contextMenu && createPortal(
        <div
          className="fixed bg-white shadow-lg rounded-md py-1 border border-gray-200"
          style={{ 
            left: `${contextMenu.x}px`, 
            top: `${contextMenu.y}px`,
            zIndex: 99999,
            minWidth: '150px'
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setEditingSchedule(contextMenu.schedule);
              setIsModalOpen(true);
              setContextMenu(null);
            }}
          >
            <span className="mr-2">✏️</span>
            編集
          </button>
          <button
            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            onClick={async () => {
              if (confirm('この予定を削除しますか？')) {
                try {
                  await deleteSchedule(contextMenu.schedule.id, currentUser?.id, 'コンテキストメニューから削除');
                  await refreshSchedules();
                } catch (error) {
                  console.error('Error deleting schedule:', error);
                  alert('予定の削除に失敗しました');
                }
              }
              setContextMenu(null);
            }}
          >
            <span className="mr-2">🗑️</span>
            削除
          </button>
        </div>,
        document.body
      )}

      {/* Schedule Creation Modal */}
      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSchedule(null);
          setSelectedDate(null);
          setSelectedParticipant(null);
          setCopiedSchedule(null);
        }}
        onSubmit={async (scheduleData) => {
          try {
            console.log('MyCalendar onSubmit called with:', scheduleData);
            console.log('Current user:', currentUser);
            console.log('Editing schedule:', editingSchedule);
            
            // 削除処理
            if (scheduleData._delete && editingSchedule) {
              try {
                console.log('フォームからの削除処理開始:', editingSchedule.id);
                await deleteSchedule(editingSchedule.id, currentUser?.id, 'ユーザーがフォームから削除');
                console.log('フォームからの削除処理完了');
                
                // 成功時はCalendarContextのrefreshSchedulesを使用してデータを更新
                await refreshSchedules();
                setIsModalOpen(false);
                setEditingSchedule(null);
                setSelectedDate(null);
                setSelectedParticipant(null);
                return;
              } catch (error) {
                console.error('Error deleting schedule:', error);
                alert('スケジュールの削除に失敗しました');
                return;
              }
            }
            
            // コピーの場合は新規作成として処理
            if (scheduleData.isCopy) {
              console.log('Copy schedule detected, creating new schedule');
              const scheduleToCreate = {
                ...scheduleData,
                createdBy: currentUser?.id
              };
              // isCopyフラグとidを削除
              delete scheduleToCreate.isCopy;
              delete scheduleToCreate.id;
              
              console.log('Creating copied schedule:', scheduleToCreate);
              
              const success = await addSchedule(scheduleToCreate);
              console.log('addSchedule result:', success);
              
              if (!success) {
                console.error('addSchedule returned false');
                return;
              }
              
              // 成功時はモーダルを閉じる
              setIsModalOpen(false);
              setEditingSchedule(null);
              setSelectedDate(null);
              setSelectedParticipant(null);
            } else if (editingSchedule) {
              // Update existing schedule using CalendarContext
              const updatedSchedule = {
                ...editingSchedule,
                ...scheduleData,
                id: editingSchedule.id,
                createdAt: editingSchedule.createdAt,
                createdBy: editingSchedule.createdBy,
                updatedBy: currentUser?.id,
                updatedAt: new Date()
              };
              console.log('Updating schedule:', updatedSchedule);
              updateSchedule(updatedSchedule);
              
              // 成功時はモーダルを閉じる
              setIsModalOpen(false);
              setEditingSchedule(null);
              setSelectedDate(null);
              setSelectedParticipant(null);
            } else {
              // Create new schedule using CalendarContext
              const scheduleToCreate = {
                ...scheduleData,
                createdBy: currentUser?.id
              };
              console.log('Creating schedule:', scheduleToCreate);
              
              const success = await addSchedule(scheduleToCreate);
              console.log('addSchedule result:', success);
              
              if (!success) {
                console.error('addSchedule returned false');
                return; // addSchedule already shows error messages
              }
              
              // 成功時、新規作成されたスケジュールを取得してメール送信確認
              const schedules = await getSchedulesForDateRange(
                scheduleData.startTime,
                scheduleData.endTime
              );
              const newSchedule = schedules.find(s => 
                s.title === scheduleData.title && 
                s.startTime.getTime() === scheduleData.startTime.getTime()
              );
              
              if (newSchedule) {
                setNewlyCreatedSchedule(newSchedule);
                // オンライン会議形式の場合のみ確認ポップアップを表示
                if (newSchedule.meetingType === 'online' && newSchedule.meetLink) {
                  const confirmed = await confirm({
                    title: 'Google Meet URL送信',
                    message: 'オンライン会議が選択されました、顧客にGoogleMeetURLをメールで送信しますか？',
                    confirmText: '送信する',
                    cancelText: '送信しない',
                    type: 'info'
                  });
                  
                  if (confirmed) {
                    setIsEmailModalOpen(true);
                  }
                }
              }
              
              // モーダルを閉じる
              setIsModalOpen(false);
              setEditingSchedule(null);
              setSelectedDate(null);
              setSelectedParticipant(null);
            }
          } catch (error) {
            console.error('Error saving schedule - Full error object:', error);
            console.error('Error message:', error?.message);
            console.error('Error stack:', error?.stack);
            alert(`スケジュールの保存に失敗しました: ${error?.message || 'Unknown error'}`);
          }
        }}
        selectedDate={selectedDate}
        selectedParticipant={selectedParticipant}
        type={
          editingSchedule && 
          editingSchedule.equipment?.some((eq: any) => eq.type === 'sample') 
            ? 'sample' 
            : 'general'
        }
        editingSchedule={editingSchedule}
      />

      <UserSelectionModal
        isOpen={isUserSelectionModalOpen}
        onClose={() => setIsUserSelectionModalOpen(false)}
        users={users}
        selectedUsers={visibleUsers}  // visibleUsersを直接渡して並び順を保持
        onUsersChange={handleUsersChange}
      />

      <ScheduleViewModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingSchedule(null);
        }}
        schedule={viewingSchedule}
        onEdit={() => {
          // 繰り返し予定の場合は元のスケジュールを編集
          if (viewingSchedule.originalId) {
            // 元のスケジュールを取得
            const originalSchedule = schedules.find(s => s.id === viewingSchedule.originalId);
            if (originalSchedule) {
              setEditingSchedule(originalSchedule);
            } else {
              setEditingSchedule(viewingSchedule);
            }
          } else {
            setEditingSchedule(viewingSchedule);
          }
          setIsModalOpen(true);
          setIsViewModalOpen(false);
          setViewingSchedule(null);
        }}
        onDelete={async (deleteAllRecurring = false) => {
          if (viewingSchedule && currentUser) {
            try {
              console.log('削除処理開始:', viewingSchedule.id, 'deleteAllRecurring:', deleteAllRecurring);
              await deleteSchedule(viewingSchedule.id, currentUser.id, 'ユーザーが手動で削除', deleteAllRecurring);
              console.log('削除処理完了');
              
              await refreshSchedules();
              setIsViewModalOpen(false);
              setViewingSchedule(null);
            } catch (error) {
              console.error('Error deleting schedule:', error);
              alert('スケジュールの削除に失敗しました');
            }
          }
        }}
      />

      {newlyCreatedSchedule && (
        <EmailSendModal
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            setNewlyCreatedSchedule(null);
            // メール送信後に状態を更新
            if (schedules.length > 0) {
              const scheduleIds = schedules.map(s => s.id);
              const statuses = getEmailSentStatuses(scheduleIds);
              setEmailStatuses(statuses);
            }
          }}
          schedule={newlyCreatedSchedule}
          users={users}
        />
      )}

      {/* 確認モーダル */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        type={confirmationState.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}