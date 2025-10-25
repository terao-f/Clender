import { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, isToday, isSameMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Users, User as UserIcon, Video, Mail, MailCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCalendar } from '../../contexts/CalendarContext';
import { useSearchParams } from 'react-router-dom';
import { mockUsers, mockSchedules } from '../../data/mockData';
import { Schedule, User } from '../../types';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import ReservationModal from '../../components/ReservationModal';
import UserSelectionModal from '../../components/UserSelectionModal';
import ScheduleViewModal from '../../components/ScheduleViewModal';
import EmailSendModal from '../../components/EmailSendModal';
import ScheduleHistoryModal from '../../components/ScheduleHistoryModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import ScheduleTooltip from '../../components/ScheduleTooltip';
import { scheduleNotificationService } from '../../services/scheduleNotificationService';
import { HolidayService } from '../../services/holidayService';
import { LeaveRequestService } from '../../services/leaveRequestService';
import { getFinalScheduleStyles, getScheduleTypeStyles } from '../../utils/scheduleColors';
import { useConfirmation } from '../../hooks/useConfirmation';

export default function MyCalendarStandalone() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const { confirm, confirmationState, handleConfirm, handleCancel } = useConfirmation();
  
  // CalendarContextを使用
  const { 
    currentDate, 
    setCurrentDate,
    view, 
    setView,
    schedules,
    visibleUsers,
    toggleUserVisibility,
    getSchedulesForDate,
    getSchedulesForDateRange,
    addSchedule,
    updateSchedule,
    deleteSchedule
  } = useCalendar();
  
  // デバッグログ

  // URLパラメータからscheduleIdを取得してモーダルを開く
  useEffect(() => {
    const scheduleId = searchParams.get('scheduleId');
    if (scheduleId && schedules.length > 0) {
      
      // スケジュールを検索
      const targetSchedule = schedules.find(schedule => schedule.id === scheduleId);
      
      if (targetSchedule) {
        setViewingSchedule(targetSchedule);
        setIsViewModalOpen(true);
        
        // URLパラメータをクリア
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('scheduleId');
        const newUrl = `${window.location.pathname}${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''}`;
        window.history.replaceState({}, '', newUrl);
      } else {
        console.log('❌ 対象スケジュールが見つかりません:', scheduleId);
        toast.error('指定されたスケジュールが見つかりません');
      }
    }
  }, [searchParams, schedules]);
  
  // Google Meet URLメールの送信状態を取得
  const fetchMeetEmailStatuses = async (scheduleList: Schedule[]) => {
    try {
      const meetSchedules = scheduleList.filter(s => s.meetLink);
      if (meetSchedules.length === 0) {
        return;
      }
      
      
      const { data, error } = await supabase
        .from('email_send_history')
        .select('schedule_id, sent_at, sender_name')
        .in('schedule_id', meetSchedules.map(s => s.id))
        .eq('email_type', 'meet_url');
      
      if (error) {
        console.error('❌ メール送信履歴の取得エラー:', error);
        console.error('エラー詳細:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        const statuses: Record<string, boolean> = {};
        data?.forEach(item => {
          statuses[item.schedule_id] = true;
        });
        setMeetEmailSentStatuses(statuses);
      }
    } catch (error) {
      console.error('❌ メール送信状態取得中のエラー:', error);
    }
  };

  // schedulesの変更を監視
  useEffect(() => {
    const googleSchedules = schedules?.filter(s => s.isFromGoogleCalendar) || [];
    
    // メール送信状態を取得
    if (schedules && schedules.length > 0) {
      fetchMeetEmailStatuses(schedules);
    }
    
    // 強制的に再レンダリングをトリガー
    setForceUpdate(prev => prev + 1);
    
    // さらに、少し遅延してから再度トリガー
    setTimeout(() => {
      setForceUpdate(prev => prev + 1);
    }, 500);
  }, [schedules]);
  
  // 強制再レンダリング用のstate
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // 週表示の開始日を初期化（月曜日を週の始まりとする）
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=日曜日, 1=月曜日, ..., 6=土曜日
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 月曜日を週の始まりとする
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  });
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 祝日・休日データ
  const [holidays, setHolidays] = useState<Map<string, { name: string; type: string }>>(new Map());
  
  // 休暇申請データ
  const [leaveRequests, setLeaveRequests] = useState<Map<string, { userId: string; reason: string; type: string }>>(new Map());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [isUserSelectionModalOpen, setIsUserSelectionModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSchedule, setViewingSchedule] = useState<Schedule | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState<Date | null>(null);
  const [copyingSchedule, setCopyingSchedule] = useState<Schedule | null>(null);
  const [copiedSchedule, setCopiedSchedule] = useState<Schedule | null>(null);
  const [newlyCreatedSchedule, setNewlyCreatedSchedule] = useState<Schedule | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyScheduleId, setHistoryScheduleId] = useState<string | null>(null);
  const [emailStatuses, setEmailStatuses] = useState<Record<string, boolean>>({});
  const [meetEmailSentStatuses, setMeetEmailSentStatuses] = useState<Record<string, boolean>>({});

  // Navigation functions
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    
    // 週表示の場合は、今日が含まれる週の月曜日を週の始まりとする
    if (view === 'week') {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      setWeekStartDate(weekStart);
    } else {
      setWeekStartDate(today);
    }
  };
  
  const goToPreviousPeriod = () => {
    const newDate = new Date(currentDate);
    if (view === 'day') newDate.setDate(newDate.getDate() - 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };
  
  const goToNextPeriod = () => {
    const newDate = new Date(currentDate);
    if (view === 'day') newDate.setDate(newDate.getDate() + 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };
  
  // Week view specific navigation
  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };
  
  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };
  
  const goToPreviousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };
  
  const goToNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  // Get dates based on view
  const getDatesForView = () => {
    switch (view) {
      case 'day':
        return [currentDate];
      case 'week':
        // 週表示: 月曜日を週の始まりとして7日間を表示
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
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

  const dates = getDatesForView();

  // カレンダー全体の表示範囲を計算
  const getCalendarDateRange = () => {
    switch (view) {
      case 'day':
        return { startDate: currentDate, endDate: addDays(currentDate, 1) };
      case 'week':
        // 週表示: 月曜日を週の始まりとして7日間の範囲を計算
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        return { startDate: weekStart, endDate: addDays(weekStart, 7) };
      case 'month':
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDateMonth = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDateMonth = addDays(startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 }), 6);
        return { startDate: startDateMonth, endDate: endDateMonth };
      default:
        return { startDate: currentDate, endDate: addDays(currentDate, 1) };
    }
  };

  // カレンダー全体のスケジュールを一度に取得
  const { startDate: calendarStartDate, endDate: calendarEndDate } = getCalendarDateRange();
  const allSchedulesInView = getSchedulesForDateRange(calendarStartDate, calendarEndDate);
  
  // デバッグログ
  console.log('📊 スケジュール取得状況:', {
    totalSchedules: allSchedulesInView.length,
    calendarStartDate: calendarStartDate.toDateString(),
    calendarEndDate: calendarEndDate.toDateString(),
    currentDate: currentDate.toDateString(),
    currentDateISO: currentDate.toISOString(),
    currentUser: currentUser ? {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role
    } : null,
    schedules: allSchedulesInView.map(s => ({
      id: s.id,
      title: s.title,
      startTime: s.startTime.toDateString(),
      endTime: s.endTime.toDateString(),
      participants: s.participants,
      createdBy: s.createdBy
    }))
  });
  
  // 開発者の予定を特別にチェック
  const devSchedules = allSchedulesInView.filter(s => 
    s.createdBy === 'e9df2750-5e50-41ec-8f23-1e4c19ac45b7' || 
    s.participants.includes('e9df2750-5e50-41ec-8f23-1e4c19ac45b7')
  );
  console.log('👨‍💻 開発者の予定:', devSchedules.map(s => ({
    id: s.id,
    title: s.title,
    startTime: s.startTime.toDateString(),
    endTime: s.endTime.toDateString(),
    participants: s.participants,
    createdBy: s.createdBy
  })));

  // Fetch schedules from Supabase
  const fetchSchedules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .order('start_time');

      if (error) {
        console.error('Failed to fetch schedules:', error);
        // CalendarContextがスケジュールを管理するため、フォールバックは不要
      } else if (data) {
        // サンプル予約を除外
        const filteredData = data.filter(schedule => {
          // サンプル関連のタイプを完全に除外
          const sampleTypes = [
            'サンプル作成',
            'CAD・マーキング', 
            'サンプル裁断',
            'サンプル縫製',
            'サンプル内職',
            'プレス',
            '仕上げ・梱包'
          ];
          
          // typeがサンプル関連の場合を除外
          if (schedule.type && (
            schedule.type.includes('サンプル') || 
            schedule.type.includes('CAD') ||
            schedule.type.includes('マーキング') ||
            schedule.type === 'プレス' ||
            schedule.type.includes('仕上げ') ||
            schedule.type.includes('梱包') ||
            sampleTypes.includes(schedule.type)
          )) {
            return false;
          }
          
          // equipment配列にtype: 'sample'が含まれている場合を除外
          if (schedule.equipment?.some((eq: any) => eq.type === 'sample')) {
            return false;
          }
          
          return true;
        });
        
        const convertedSchedules: Schedule[] = filteredData.map(schedule => {
          const converted = {
          id: schedule.id,
          type: schedule.type,
          title: schedule.title,
          details: schedule.details || '',
          startTime: new Date(schedule.start_time),
          endTime: new Date(schedule.end_time),
          isAllDay: schedule.is_all_day,
          isMultiDay: schedule.is_multi_day || false,
          recurrence: schedule.recurrence,
          participants: schedule.participants || [],
          equipment: schedule.equipment || [],
          reminders: schedule.reminders || [],
          meetLink: schedule.meet_link,
          meetingType: schedule.meeting_type || 'in-person',
          createdBy: schedule.created_by,
          createdAt: new Date(schedule.created_at),
          updatedBy: schedule.updated_by,
            updatedAt: schedule.updated_at ? new Date(schedule.updated_at) : null,
            isFromGoogleCalendar: schedule.is_from_google_calendar || false
          };
          
          
          return converted;
        });
        // CalendarContextがスケジュールを管理するため、setSchedulesは不要
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      // CalendarContextがスケジュールを管理するため、setSchedulesは不要
    }
  }, []);

  // Get schedules for a specific user and date
  // CalendarContextのgetSchedulesForDateを使用

  // 参加者名を取得する関数（セル表示用：2名まで）
  const getParticipantNames = (participantIds: string[], maxLength: number = 50) => {
    if (!participantIds || participantIds.length === 0) return '';
    
    const names = participantIds
      .map(id => users.find(user => user.id === id)?.name)
      .filter(Boolean);
    
    // セル表示では2名まで表示、3名以降は「他○名」
    if (names.length > 2) {
      return names.slice(0, 2).join(', ') + ` 他${names.length - 2}名`;
    }
    
    return names.join(', ');
  };

  // 参加者名を取得する関数（ツールチップ表示用：全員）
  const getParticipantNamesForTooltip = (participantIds: string[]) => {
    if (!participantIds || participantIds.length === 0) return '';
    
    const names = participantIds
      .map(id => users.find(user => user.id === id)?.name)
      .filter(Boolean);
    
    return names.join(', ');
  };

  // Schedule CRUD operations - CalendarContextのaddScheduleを使用

  // CalendarContextのupdateScheduleとdeleteScheduleを使用


  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Load users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name');
      
      if (usersError || !usersData) {
        setUsers(mockUsers);
      } else {
        setUsers(usersData);
      }
      
      // Load schedules
      await fetchSchedules();
      
      setLoading(false);
    };
    
    loadData();
  }, [fetchSchedules]);

  // 祝日・休日データを取得
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(currentYear + 1, 11, 31);
        
        const holidayData = await HolidayService.getHolidays(startDate, endDate);
        const holidayMap = new Map<string, { name: string; type: string }>();
        
        holidayData.forEach(holiday => {
          // ローカル時間の日付文字列を生成（タイムゾーンオフセットを避ける）
          const year = holiday.date.getFullYear();
          const month = String(holiday.date.getMonth() + 1).padStart(2, '0');
          const day = String(holiday.date.getDate()).padStart(2, '0');
          const dateKey = `${year}-${month}-${day}`;
          holidayMap.set(dateKey, {
            name: holiday.name,
            type: holiday.type
          });
        });
        
        setHolidays(holidayMap);
      } catch (error) {
        console.error('Error fetching holidays:', error);
      }
    };
    
    fetchHolidays();
  }, []);

  // 休暇申請データを取得
  useEffect(() => {
    const fetchLeaveRequests = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(currentYear + 1, 11, 31);
        
        const leaveData = await LeaveRequestService.getApprovedLeaveRequests(startDate, endDate);
        const leaveMap = new Map<string, { userId: string; reason: string; type: string }>();
        
        leaveData.forEach(leave => {
          const dateKey = leave.date;
          leaveMap.set(dateKey, {
            userId: leave.userId,
            reason: leave.reason,
            type: leave.type
          });
        });
        
        setLeaveRequests(leaveMap);
      } catch (error) {
        console.error('Error fetching leave requests:', error);
      }
    };
    
    fetchLeaveRequests();
  }, []);

  // CalendarContextがユーザー表示設定を管理するため、独自の処理は不要

  // Handle modal from search params - 一時的にコメントアウト
  // useEffect(() => {
  //   const action = searchParams.get('action');
  //   const date = searchParams.get('date');
  //   
  //   if (action === 'new' && date) {
  //     setSelectedDate(new Date(date));
  //     setIsModalOpen(true);
  //   }
  // }, [searchParams]);

  // URLパラメータからスケジュールIDを取得して詳細を開く - 一時的にコメントアウト
  // useEffect(() => {
  //   const scheduleId = searchParams.get('scheduleId');
  //   console.log('=== Schedule ID from URL ===');
  //   console.log('scheduleId:', scheduleId);
  //   console.log('schedules.length:', schedules.length);
  //   console.log('Current URL:', window.location.href);
  //   
  //   if (scheduleId && schedules.length > 0) {
  //     console.log('Looking for schedule with ID:', scheduleId);
  //     const targetSchedule = schedules.find(s => s.id === scheduleId);
  //     console.log('Found schedule:', targetSchedule);
  //     
  //     if (targetSchedule) {
  //       console.log('Opening schedule detail modal');
  //       setViewingSchedule(targetSchedule);
  //       setIsViewModalOpen(true);
  //       // URLパラメータをクリア
  //       window.history.replaceState({}, '', window.location.pathname);
  //     } else {
  //       console.log('Schedule not found in current schedules');
  //     }
  //   }
  // }, [searchParams, schedules]);

  const handleCellClick = (user: User, date: Date) => {
    setSelectedParticipant(user.id);
    setSelectedDate(date);
    setEditingSchedule(null);
    setIsModalOpen(true);
  };

  const handleScheduleClick = (schedule: Schedule) => {
    setViewingSchedule(schedule);
    setIsViewModalOpen(true);
  };

  const handleScheduleCopy = async () => {
    console.log('🔍 コピー処理開始時の状態チェック:');
    console.log('  - copyingSchedule:', copyingSchedule);
    console.log('  - copyTargetDate:', copyTargetDate);
    console.log('  - copyTargetDate type:', typeof copyTargetDate);
    console.log('  - copyTargetDate is null:', copyTargetDate === null);
    console.log('  - copyTargetDate is undefined:', copyTargetDate === undefined);
    
    if (!copyingSchedule) {
      alert('コピーする予定が見つかりません');
      return;
    }
    
    if (!copyTargetDate) {
      alert('コピー先の日付を選択してください');
      return;
    }

    try {
      console.log('✅ === コピー処理開始 ===');
      console.log('🔍 現在の状態:');
      console.log('  - copyingSchedule:', copyingSchedule);
      console.log('  - copyTargetDate:', copyTargetDate);

      // コピーデータを作成
      const timeDiff = new Date(copyingSchedule.endTime).getTime() - new Date(copyingSchedule.startTime).getTime();
      const newStartTime = new Date(copyTargetDate);
      newStartTime.setHours(new Date(copyingSchedule.startTime).getHours(), new Date(copyingSchedule.startTime).getMinutes(), 0, 0);
      const newEndTime = new Date(newStartTime.getTime() + timeDiff);

      const copyData = {
        type: copyingSchedule.type || '会議',
        title: copyingSchedule.title ? `${copyingSchedule.title} (コピー)` : '',
        details: copyingSchedule.details || '',
        startTime: newStartTime,
        endTime: newEndTime,
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
        participants: copyingSchedule.participants || [],
        equipment: copyingSchedule.equipment || [],
        isAllDay: copyingSchedule.isAllDay || false,
        isMultiDay: copyingSchedule.isMultiDay || false,
        meetLink: copyingSchedule.meetLink || '',
        meetingType: copyingSchedule.meetingType || '',
        notes: copyingSchedule.notes || '',
        createdBy: currentUser?.id || '',
        recurrence: null, // コピー時は繰り返しをリセット
        is_from_google_calendar: false // 新規作成なのでfalse
      };

      console.log('📦 作成したコピーデータ:', copyData);

      // バリデーション
      const validationErrors = [];
      if (!copyData.title) validationErrors.push('タイトルがありません');
      if (!copyData.startTime) validationErrors.push('開始時刻がありません');
      if (!copyData.endTime) validationErrors.push('終了時刻がありません');

      if (validationErrors.length > 0) {
        console.error('❌ バリデーションエラー:', validationErrors);
        alert('コピーデータに問題があります:\n' + validationErrors.join('\n'));
        return;
      }

      console.log('✅ バリデーションOK');

      // データベースに保存
      const { data, error } = await supabase
        .from('schedules')
        .insert([{
          type: copyData.type,
          title: copyData.title,
          details: copyData.details,
          start_time: copyData.start_time,
          end_time: copyData.end_time,
          participants: copyData.participants,
          equipment: copyData.equipment,
          is_all_day: copyData.isAllDay,
          is_multi_day: copyData.isMultiDay,
          meet_link: copyData.meetLink,
          meeting_type: copyData.meetingType,
          notes: copyData.notes,
          created_by: copyData.createdBy,
          recurrence: copyData.recurrence,
          is_from_google_calendar: copyData.is_from_google_calendar
        }])
        .select();

      if (error) {
        console.error('❌ データベース保存エラー:', error);
        console.error('❌ エラー詳細:', JSON.stringify(error, null, 2));
        console.error('❌ 送信データ:', JSON.stringify({
          type: copyData.type,
          title: copyData.title,
          details: copyData.details,
          start_time: copyData.start_time,
          end_time: copyData.end_time,
          participants: copyData.participants,
          equipment: copyData.equipment,
          is_all_day: copyData.isAllDay,
          is_multi_day: copyData.isMultiDay,
          meet_link: copyData.meetLink,
          meeting_type: copyData.meetingType,
          notes: copyData.notes,
          created_by: copyData.createdBy,
          recurrence: copyData.recurrence,
          is_from_google_calendar: copyData.is_from_google_calendar
        }, null, 2));
        alert('コピーに失敗しました: ' + (error.message || '不明なエラー'));
        return;
      }

      console.log('✅ データベース保存成功:', data);

      // 成功メッセージ
      toast.success('スケジュールをコピーしました');
      
      // モーダルを閉じる
      setShowCopyModal(false);
      setCopyTargetDate(null);
      setCopyingSchedule(null);
      
      // スケジュールを再取得
      await fetchSchedules();

    } catch (error) {
      console.error('❌ コピー処理エラー:', error);
      alert('コピーに失敗しました: ' + (error as Error).message);
    }
  };

  const handleScheduleDelete = async (schedule: any, deleteAllRecurring: boolean = false) => {
    if (!schedule?.id) return;

    try {

      // CalendarContextのdeleteSchedule関数を使用
      await deleteSchedule(schedule.id, currentUser?.id, undefined, deleteAllRecurring);
      
    } catch (error) {
      console.error('削除エラー:', error);
      alert(`削除に失敗しました: ${error}`);
    }
  };

  const handleReservationSubmit = async (scheduleData: any) => {
    console.log('🔵 === MyCalendarStandalone.handleReservationSubmit called ===');
    console.log('scheduleData:', scheduleData);
    console.log('editingSchedule:', editingSchedule);
    
    try {
      // 削除処理
      if (scheduleData._delete && editingSchedule) {
        console.log('🗑️ 削除処理を実行');
        // 繰り返し予約の個別インスタンスの場合は元のIDを使用
        const scheduleId = editingSchedule.originalId || editingSchedule.id;
        console.log('🗑️ 削除処理詳細:', {
          editingSchedule: editingSchedule,
          scheduleId: scheduleId,
          originalId: editingSchedule.originalId,
          instanceId: editingSchedule.id
        });
        await deleteSchedule(scheduleId);
        setIsModalOpen(false);
        setEditingSchedule(null);
        return;
      }
      
      // コピー処理の場合は新規作成として処理
      if (scheduleData.isCopy) {
        console.log('📋 コピー処理を実行（新規作成）');
        // isCopyフラグとIDを削除
        const { isCopy, id, ...newScheduleData } = scheduleData;
        const success = await addSchedule({
          ...newScheduleData,
          createdBy: currentUser?.id
        });
        if (success) {
          setIsModalOpen(false);
          setEditingSchedule(null);
        }
      // 更新処理
      } else if (editingSchedule) {
        console.log('✏️ 更新処理を実行');
        
        // Googleカレンダーからの予定を編集した場合は新規登録扱いで上書き
        if (editingSchedule.isFromGoogleCalendar || editingSchedule.is_from_google_calendar) {
          console.log('🔄 Googleカレンダーからの予定を編集 - 新規登録扱いで上書き');
          
          // 元のスケジュールを削除
          const scheduleId = editingSchedule.originalId || editingSchedule.id;
          await deleteSchedule(scheduleId);
          
          // 新規作成として登録（isFromGoogleCalendarフラグを削除）
          const newScheduleData = {
            ...scheduleData,
            isFromGoogleCalendar: false,
            is_from_google_calendar: false,
            createdBy: currentUser?.id,
            excludeScheduleId: scheduleId // 削除前の予定IDを除外
          };
          
          const success = await addSchedule(newScheduleData);
          if (success) {
            setIsModalOpen(false);
            setEditingSchedule(null);
          }
          return;
        }
        
        // 通常の更新処理
        const scheduleId = editingSchedule.originalId || editingSchedule.id;
        
        // 種別が変更された場合はGoogleカレンダーフラグを削除
        const typeChanged = editingSchedule.type !== scheduleData.type;
        const updatedSchedule = {
          ...editingSchedule,
          ...scheduleData,
          id: scheduleId, // 元のスケジュールIDを使用
          updatedBy: currentUser?.id,
          updatedAt: new Date(),
          // 種別が変更された場合はGoogleカレンダーフラグを削除
          isFromGoogleCalendar: typeChanged ? false : editingSchedule.isFromGoogleCalendar,
          is_from_google_calendar: typeChanged ? false : editingSchedule.is_from_google_calendar
        };
        await updateSchedule(updatedSchedule);
        setIsModalOpen(false);
        setEditingSchedule(null);
      } else {
        // 新規作成処理
        console.log('➕ 新規作成処理を実行');
        console.log('  - sendEmailOnSave:', scheduleData.sendEmailOnSave);
        console.log('  - participants:', scheduleData.participants);
        console.log('  - meetingType:', scheduleData.meetingType);
        console.log('  - meetLink:', scheduleData.meetLink);
        
        const success = await addSchedule(scheduleData);
        console.log('  - 作成結果:', success);
        
        if (success) {
          // オンライン会議形式の場合のみ確認ポップアップを表示
          if (scheduleData.meetingType === 'online' && scheduleData.meetLink) {
            const confirmed = await confirm({
              title: 'Google Meet URL送信',
              message: 'オンライン会議が選択されました、顧客にGoogleMeetURLをメールで送信しますか？',
              confirmText: '送信する',
              cancelText: '送信しない',
              type: 'info'
            });
            
            if (confirmed) {
              // 作成されたスケジュールを取得してメール送信モーダルを開く
              const { data: newScheduleData } = await supabase
                .from('schedules')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
                
              if (newScheduleData) {
                const savedSchedule = {
                  ...newScheduleData,
                  startTime: new Date(newScheduleData.start_time),
                  endTime: new Date(newScheduleData.end_time),
                  createdAt: new Date(newScheduleData.created_at),
                  updatedAt: new Date(newScheduleData.updated_at),
                  meetingType: newScheduleData.meeting_type,
                  isAllDay: newScheduleData.is_all_day,
                  meetLink: newScheduleData.meet_link,
                  createdBy: newScheduleData.created_by,
                  updatedBy: newScheduleData.updated_by
                };
                setNewlyCreatedSchedule(savedSchedule);
                setIsEmailModalOpen(true);
              }
            }
          }
          setIsModalOpen(false);
        }
      }
    } catch (error) {
      console.error('Error saving reservation:', error);
      toast.error('予約の保存に失敗しました');
    }
  };

  // Render calendar content based on view
  const renderCalendarContent = () => {
    if (view === 'month') {
      return renderMonthView();
    } else {
      return renderTableView();
    }
  };

  const renderTableView = useCallback(() => {
    // visibleUsersの順序に従ってユーザーを並び替える
    const displayUsers = visibleUsers.length > 0 
      ? visibleUsers
          .map(userId => users.find(u => u.id === userId))
          .filter(Boolean) as User[]
      : users.filter(user => visibleUsers.includes(user.id));
    
    // デバッグログ
    console.log('👥 表示ユーザー情報:', {
      visibleUsers,
      displayUsers: displayUsers.map(u => ({ id: u.id, name: u.name })),
      currentUser: currentUser ? { id: currentUser.id, name: currentUser.name } : null
    });
    
    // ユーザーが選択されていない場合のメッセージ表示
    if (displayUsers.length === 0) {
      return (
        <div className="relative" style={{ minHeight: 'calc(100vh - 300px)' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">表示するユーザーを選択してください</h3>
              <p className="text-sm text-gray-500 mb-6">右上の「表示ユーザー管理」ボタンからユーザーを選択できます</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto overflow-y-auto relative" style={{ maxHeight: 'calc(100vh - 280px)', WebkitOverflowScrolling: 'touch' }}>
        <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'auto' }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20" style={{ minWidth: '120px', width: 'auto' }}>
                ユーザー
              </th>
              {dates.map((date, i) => (
                <th key={i} scope="col" className="px-1 sm:px-2 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ 
                  minWidth: view === 'week' ? '120px' : '150px' 
                }}>
                  <div className="flex flex-col items-center">
                    <span>{format(date, view === 'day' ? 'yyyy年M月d日 EEEE' : 'EEEE', { locale: ja })}</span>
                    {view !== 'day' && (
                      <span className={`mt-1 text-sm ${isToday(date) ? 'bg-blue-100 text-blue-800 rounded-full w-7 h-7 flex items-center justify-center' : ''}`}>
                        {format(date, 'd')}
                      </span>
                    )}
                    {/* 祝日・休日表示 */}
                    {(() => {
                      // ローカル時間の日付文字列を生成
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const dateKey = `${year}-${month}-${day}`;
                      const holiday = holidays.get(dateKey);
                      if (holiday) {
                        return (
                          <div className={`mt-1 text-xs px-1 py-0.5 rounded ${
                            holiday.type === 'national_holiday' 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {holiday.name}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {/* 休暇申請表示 */}
                    {(() => {
                      const dateKey = date.toISOString().split('T')[0];
                      const leaveRequest = leaveRequests.get(dateKey);
                      if (leaveRequest) {
                        const user = users.find(u => u.id === leaveRequest.userId);
                        if (user) {
                          return (
                            <div className="mt-1 text-xs px-1 py-0.5 rounded bg-orange-100 text-orange-700">
                              {user.name} 休暇
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayUsers.map((user) => (
              <tr key={user.id}>
                <td className="px-2 sm:px-4 py-3 sm:py-4 sticky left-0 bg-white z-10" style={{ minWidth: '120px', width: 'auto' }}>
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                    </div>
                    <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">{user.name}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 hidden sm:block truncate">{user.department}</div>
                    </div>
                  </div>
                </td>
                {dates.map((date, i) => {
                  // 月表示の正確なロジックを使用
                  const daySchedules = allSchedulesInView.filter(schedule => {
                    // 1. ユーザーが参加者または作成者かチェック
                    const isParticipant = schedule.participants.includes(user.id);
                    const isCreator = schedule.createdBy === user.id;
                    
                    // 2. 代理入力の場合：作成者が参加者リストに含まれている場合のみ表示
                    if (isCreator && !isParticipant) {
                      return false; // 作成者だが参加者でない場合は表示しない
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
                    
                    // デバッグログ：今日の日付（18日）での比較を詳しく確認
                    if (user.id === 'e9df2750-5e50-41ec-8f23-1e4c19ac45b7' && targetDateOnly.getDate() === 18) {
                      console.log('📅 18日の日付比較デバッグ:', {
                        scheduleTitle: schedule.title,
                        scheduleId: schedule.id,
                        scheduleStart: scheduleStart.toISOString(),
                        scheduleEnd: scheduleEnd.toISOString(),
                        scheduleStartDate: scheduleStartDate.toDateString(),
                        scheduleEndDate: scheduleEndDate.toDateString(),
                        targetDate: targetDate.toISOString(),
                        targetDateOnly: targetDateOnly.toDateString(),
                        dateMatch,
                        isParticipant,
                        isCreator,
                        finalResult: (isParticipant || isCreator) && dateMatch
                      });
                    }
                    
                    return (isParticipant || isCreator) && dateMatch;
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
                  
                  return (
                    <td 
                      key={i} 
                      className="px-2 py-2 text-sm text-gray-500 relative group border border-gray-100 align-top cursor-pointer hover:bg-gray-50 transition-colors duration-200" 
                      style={{ 
                        width: view === 'week' ? `calc((100% - 120px) / 7)` : '180px',
                        minWidth: view === 'week' ? '120px' : '180px'
                      }}
                      onClick={() => handleCellClick(user, date)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellClick(user, date);
                        }}
                        className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 bg-blue-100 rounded-full p-1.5 sm:p-1 z-10 touch-manipulation"
                      >
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                      </button>
                      <div className={view === 'day' ? 'min-h-[100px] sm:min-h-[120px]' : 'min-h-[70px] sm:min-h-[80px] space-y-0.5 sm:space-y-1'}>
                        {daySchedules.map(schedule => {
                          const isMultiDay = schedule.isMultiDay || (schedule.endTime.toDateString() !== schedule.startTime.toDateString());
                          const isStartDay = schedule.startTime.toDateString() === date.toDateString();
                          
                          // 複数日予約の日数計算
                          const duration = isMultiDay ? Math.ceil((schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60 * 24)) : 1;
                          const dayPosition = isMultiDay ? Math.ceil((date.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1;
                          
                          // デバッグログ：週表示の一番左の予定をチェック
                          if (view === 'week' && i === 0 && user.id === 'e9df2750-5e50-41ec-8f23-1e4c19ac45b7') {
                            console.log('🔍 週表示一番左の予定デバッグ:', {
                              scheduleTitle: schedule.title,
                              scheduleId: schedule.id,
                              date: date.toDateString(),
                              scheduleStart: schedule.startTime.toDateString(),
                              scheduleEnd: schedule.endTime.toDateString(),
                              isMultiDay,
                              isStartDay,
                              duration,
                              dayPosition,
                              isFromGoogleCalendar: schedule.isFromGoogleCalendar
                            });
                          }
                          
                          // スケジュールタイプに基づいて色を設定
                          const styles = getFinalScheduleStyles(schedule);
                          const { bgColor, textColor, borderColor } = styles;
                          
                          // デバッグログ
                          if (schedule.isFromGoogleCalendar) {
                          }
                          
                          
                          return (
                            <ScheduleTooltip
                              key={schedule.id}
                              title={schedule.title}
                              participants={schedule.participants ? getParticipantNamesForTooltip(schedule.participants) : undefined}
                              details={schedule.details}
                              assignedTo={schedule.assignedTo ? users.find(u => u.id === schedule.assignedTo)?.name : undefined}
                              notes={schedule.notes}
                            >
                              <div 
                                className={`mb-0.5 sm:mb-1 px-1 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs ${bgColor} ${textColor} border-l-2 ${borderColor} cursor-pointer hover:opacity-80 break-words touch-manipulation`}
                                onClick={(e) => { e.stopPropagation(); handleScheduleClick(schedule); }}
                              >
                                {isMultiDay && !isStartDay ? (
                                  // 継続日の簡略表示
                                  <div className="flex flex-col space-y-0.5">
                                    <div className="flex items-center space-x-1">
                                      <div className="text-[9px] sm:text-[10px] font-medium opacity-70">
                                        ← 継続 ({dayPosition}/{duration}日目)
                                      </div>
                                    </div>
                                    <div className="truncate text-[10px] sm:text-xs font-medium flex items-center gap-1">
                                      {schedule.isFromGoogleCalendar && (
                                        <span className="text-xs" title="Googleカレンダーからの入力">📅</span>
                                      )}
                                      {schedule.title}
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
                                    </div>
                                    {schedule.type && schedule.type !== 'default' && (
                                      <div className="text-[9px] opacity-70 truncate">
                                        種別: {schedule.type}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  // 開始日または単日の通常表示
                                  <>
                                    <div className="font-medium">
                                      {schedule.isAllDay
                                        ? '終日'
                                        : isMultiDay 
                                          ? `${format(schedule.startTime, 'M/d')}〜${format(schedule.endTime, 'M/d')}`
                                          : `${format(schedule.startTime, 'HH:mm')}-${format(schedule.endTime, 'HH:mm')}`
                                      }
                                      {isMultiDay && (
                                        <span className="text-[9px] font-medium opacity-70 ml-1">
                                          ({duration}日間)
                                        </span>
                                      )}
                                    </div>
                                    <div className="break-words line-clamp-2 flex items-center gap-1">
                                      {schedule.isFromGoogleCalendar && (
                                        <span className="text-xs" title="Googleカレンダーからの入力">📅</span>
                                      )}
                                      {schedule.title}
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
                                    </div>
                                    {schedule.type && schedule.type !== 'default' && (
                                      <div className="text-[10px] opacity-70 break-words">
                                        種別: {schedule.type}
                                      </div>
                                    )}
                                    {schedule.participants && schedule.participants.length > 0 && (
                                      <div className="text-[10px] opacity-75 break-words">
                                        参加者: {getParticipantNames(schedule.participants, 100)}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </ScheduleTooltip>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [forceUpdate, visibleUsers, users, currentDate, view, weekStartDate, allSchedulesInView, handleScheduleClick, handleReservationSubmit, currentUser]);

  const renderMonthView = () => {
    // visibleUsersの順序に従ってユーザーを並び替える
    const displayUsers = visibleUsers.length > 0 
      ? visibleUsers
          .map(userId => users.find(u => u.id === userId))
          .filter(Boolean) as User[]
      : users.filter(user => visibleUsers.includes(user.id));

    // ユーザーが選択されていない場合のメッセージ表示
    if (displayUsers.length === 0) {
      return (
        <div className="relative" style={{ minHeight: 'calc(100vh - 300px)' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">表示するユーザーを選択してください</h3>
              <p className="text-sm text-gray-500 mb-6">右上の「表示ユーザー管理」ボタンからユーザーを選択できます</p>
            </div>
          </div>
        </div>
      );
    }

    const weeks = [];
    for (let i = 0; i < dates.length; i += 7) {
      weeks.push(dates.slice(i, i + 7));
    }

    return (
      <div className="overflow-auto">
        {/* Month header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {['月', '火', '水', '木', '金', '土', '日'].map((day, i) => (
            <div key={i} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              {day}
            </div>
          ))}
        </div>
        
        {/* Month body */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-200">
            {week.map((date, dayIndex) => {
              const isCurrentMonth = isSameMonth(date, currentDate);
              const daySchedules = visibleUsers.flatMap(userId => 
                allSchedulesInView.filter(schedule => {
                  // 週表示/日表示と同じシンプルなロジックに統一
                  const isParticipant = schedule.participants.includes(userId);
                  const isCreator = schedule.createdBy === userId;
                  
                  // 代理入力の場合：作成者が参加者リストに含まれている場合のみ表示
                  if (isCreator && !isParticipant) {
                    return false; // 作成者だが参加者でない場合は表示しない
                  }
                  
                  // 日付マッチング：その日の予定かチェック
                  const scheduleStart = new Date(schedule.startTime);
                  const scheduleEnd = new Date(schedule.endTime);
                  const targetDate = new Date(date);
                  
                  // 日付のみで比較（時刻は無視）
                  const scheduleStartDate = new Date(scheduleStart.getFullYear(), scheduleStart.getMonth(), scheduleStart.getDate());
                  const scheduleEndDate = new Date(scheduleEnd.getFullYear(), scheduleEnd.getMonth(), scheduleEnd.getDate());
                  const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
                  
                  // 予定の期間内にその日が含まれているかチェック
                  const dateMatch = targetDateOnly >= scheduleStartDate && targetDateOnly <= scheduleEndDate;
                  
                  return (isParticipant || isCreator) && dateMatch;
                })
              ).sort((a, b) => {
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
              
              return (
                <div 
                  key={dayIndex} 
                  className={`min-h-[120px] p-2 border-r border-gray-200 ${
                    !isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
                  }`}
                >
                  <div className="flex flex-col">
                    <div className={`text-sm font-medium mb-1 ${
                      isToday(date) ? 'bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center' : ''
                    }`}>
                      {format(date, 'd')}
                    </div>
                    {/* 祝日・休日表示 */}
                    {(() => {
                      // ローカル時間の日付文字列を生成
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const dateKey = `${year}-${month}-${day}`;
                      const holiday = holidays.get(dateKey);
                      if (holiday) {
                        return (
                          <div className={`text-xs px-1 py-0.5 rounded mb-1 ${
                            holiday.type === 'national_holiday' 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {holiday.name}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {/* 休暇申請表示 */}
                    {(() => {
                      const dateKey = date.toISOString().split('T')[0];
                      const leaveRequest = leaveRequests.get(dateKey);
                      if (leaveRequest) {
                        const user = users.find(u => u.id === leaveRequest.userId);
                        if (user) {
                          return (
                            <div className="text-xs px-1 py-0.5 rounded mb-1 bg-orange-100 text-orange-700">
                              {user.name} 休暇
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                  <div className="space-y-1">
                    {daySchedules.slice(0, 3).map(schedule => {
                      const user = users.find(u => schedule.participants.includes(u.id));
                      const isMultiDay = schedule.isMultiDay || (schedule.endTime.toDateString() !== schedule.startTime.toDateString());
                      const isStartDay = schedule.startTime.toDateString() === date.toDateString();
                      
                      // 複数日予約の日数計算
                      const duration = isMultiDay ? Math.ceil((schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60 * 24)) : 1;
                      const dayPosition = isMultiDay ? Math.ceil((date.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1;
                      
                      // スケジュールタイプに基づいて色を設定
                      const styles = getScheduleTypeStyles(schedule.type || 'default', schedule.isFromGoogleCalendar);
                      const { bgColor, textColor } = styles;
                      
                      // デバッグログ
                      if (schedule.isFromGoogleCalendar) {
                        console.log('🔍 Googleカレンダーからのスケジュール:', {
                          title: schedule.title,
                          isFromGoogleCalendar: schedule.isFromGoogleCalendar,
                          bgColor,
                          textColor
                        });
                      }
                      
                      return (
                        <ScheduleTooltip
                          key={schedule.id}
                          title={schedule.title}
                          participants={schedule.participants ? getParticipantNamesForTooltip(schedule.participants) : undefined}
                          details={schedule.details}
                          assignedTo={schedule.assignedTo ? users.find(u => u.id === schedule.assignedTo)?.name : undefined}
                          notes={schedule.notes}
                        >
                          <div 
                            onClick={(e) => { e.stopPropagation(); handleScheduleClick(schedule); }}
                            className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${bgColor} ${textColor}`}
                          >
                            {isMultiDay && !isStartDay ? (
                              // 継続日の簡略表示
                              <div className="flex items-center space-x-1">
                                <UserIcon className="h-3 w-3 flex-shrink-0" />
                                <span className="text-[10px] font-medium opacity-70">
                                  ← 継続 ({dayPosition}/{duration}日目)
                                </span>
                              </div>
                            ) : (
                              // 開始日または単日の通常表示
                              <>
                              <div className="flex items-center space-x-1">
                                <UserIcon className="h-3 w-3 flex-shrink-0" />
                                  {schedule.isFromGoogleCalendar && (
                                    <span className="text-xs" title="Googleカレンダーからの入力">📅</span>
                                  )}
                                <span className="truncate">{schedule.title}</span>
                                {isMultiDay && (
                                  <span className="text-[9px] font-medium opacity-70">
                                    ({duration}日間)
                                  </span>
                                )}
                                {schedule.meetLink && (
                                  <>
                                    <Video className="h-3 w-3 text-gray-600" />
                                    {meetEmailSentStatuses[schedule.id] && (
                                      <Mail className="h-3 w-3 text-red-600" title="Google Meet URLメール送信済み" />
                                    )}
                                  </>
                                )}
                                </div>
                                {schedule.type && schedule.type !== 'default' && (
                                  <div className="text-[10px] opacity-70 truncate">
                                    種別: {schedule.type}
                              </div>
                                )}
                              </>
                            )}
                          </div>
                        </ScheduleTooltip>
                      );
                    })}
                    {daySchedules.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{daySchedules.length - 3}件
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div key={`my-calendar-${forceUpdate}`} className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-3 sm:mb-4 px-3 sm:px-0">
        <h1 className="text-lg sm:text-2xl font-semibold text-gray-900">マイカレンダー</h1>
        <button
          onClick={() => {
            setSelectedParticipant(null);
            setSelectedDate(null);
            setEditingSchedule(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-3 sm:px-4 py-2.5 sm:py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 touch-manipulation"
        >
          <Plus className="h-4 sm:h-5 w-4 sm:w-5 sm:mr-1" />
          <span className="hidden sm:inline">予約作成</span>
          <span className="sm:hidden">作成</span>
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-3 sm:px-4 py-3 sm:py-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <div className="order-2 sm:order-1">
              <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">
                {format(currentDate, 'yyyy年M月', { locale: ja })}
              </h3>
            </div>
            <div className="order-1 sm:order-2 flex flex-wrap items-center gap-2 sm:gap-3 justify-between sm:justify-end">
              {/* 表示ユーザー選択 */}
              <button
                onClick={() => setIsUserSelectionModalOpen(true)}
                className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 touch-manipulation min-w-[50px]"
              >
                <Users className="h-3 sm:h-4 w-3 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">表示: </span>{visibleUsers.length}<span className="hidden sm:inline">人</span>
              </button>
              
              {/* ビュー切り替え - モバイルでは週表示のみ、デスクトップでは全表示 */}
              <div className="hidden sm:inline-flex shadow-sm rounded-md">
                <button
                  type="button"
                  onClick={() => setView('day')}
                  className={`relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                    view === 'day' ? 'text-blue-600 z-10 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  日
                </button>
                <button
                  type="button"
                  onClick={() => setView('week')}
                  className={`relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium ${
                    view === 'week' ? 'text-blue-600 z-10 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  週
                </button>
                <button
                  type="button"
                  onClick={() => setView('month')}
                  className={`relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                    view === 'month' ? 'text-blue-600 z-10 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
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
              
              {/* ナビゲーション */}
              {view === 'week' ? (
                <div className="inline-flex rounded-md shadow-sm">
                  <button
                    type="button"
                    onClick={goToPreviousWeek}
                    className="relative inline-flex items-center px-3 sm:px-3 py-2 sm:py-2 rounded-l-md border border-gray-300 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 touch-manipulation"
                  >
                    <span className="hidden sm:inline">先週</span>
                    <span className="sm:hidden">&lt;&lt;</span>
                  </button>
                  <button
                    type="button"
                    onClick={goToPreviousDay}
                    className="hidden sm:inline-flex items-center px-3 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 touch-manipulation"
                  >
                    前の日
                  </button>
                  <button
                    type="button"
                    onClick={goToToday}
                    className="relative inline-flex items-center px-3 sm:px-4 py-2 sm:py-2 border-t border-b border-gray-300 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 touch-manipulation"
                  >
                    今日
                  </button>
                  <button
                    type="button"
                    onClick={goToNextDay}
                    className="hidden sm:inline-flex items-center px-3 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 touch-manipulation"
                  >
                    次の日
                  </button>
                  <button
                    type="button"
                    onClick={goToNextWeek}
                    className="relative inline-flex items-center px-3 sm:px-3 py-2 sm:py-2 rounded-r-md border border-gray-300 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 touch-manipulation"
                  >
                    <span className="hidden sm:inline">来週</span>
                    <span className="sm:hidden">&gt;&gt;</span>
                  </button>
                </div>
              ) : (
                <div className="inline-flex rounded-md shadow-sm">
                  <button
                    type="button"
                    onClick={goToPreviousPeriod}
                    className="relative inline-flex items-center px-2.5 sm:px-2 py-2 sm:py-2 rounded-l-md border border-gray-300 bg-white text-xs sm:text-sm font-medium text-gray-500 hover:bg-gray-50 touch-manipulation"
                  >
                    <span className="sr-only">前へ</span>
                    <ChevronLeft className="h-4 sm:h-5 w-4 sm:w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goToToday}
                    className="relative inline-flex items-center px-3 sm:px-4 py-2 sm:py-2 border-t border-b border-gray-300 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 touch-manipulation"
                  >
                    今日
                  </button>
                  <button
                    type="button"
                    onClick={goToNextPeriod}
                    className="relative inline-flex items-center px-2.5 sm:px-2 py-2 sm:py-2 rounded-r-md border border-gray-300 bg-white text-xs sm:text-sm font-medium text-gray-500 hover:bg-gray-50 touch-manipulation"
                  >
                    <span className="sr-only">次へ</span>
                    <ChevronRight className="h-4 sm:h-5 w-4 sm:w-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {renderCalendarContent()}
      </div>

      {/* Modals */}
      {isModalOpen && (
        <ReservationModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSchedule(null);
            setSelectedDate(null);
            setSelectedParticipant(null);
          }}
          onSubmit={handleReservationSubmit}
          selectedDate={selectedDate || undefined}
          type="general"
          editingSchedule={editingSchedule || undefined}
          selectedParticipant={selectedParticipant || undefined}
        />
      )}

      {isUserSelectionModalOpen && (
        <UserSelectionModal
          isOpen={isUserSelectionModalOpen}
          onClose={() => setIsUserSelectionModalOpen(false)}
          users={users}
          selectedUsers={visibleUsers}  // visibleUsersを直接渡して並び順を保持
          onUsersChange={(newSelection) => {
            // CalendarContextのtoggleUserVisibilityを使用
            toggleUserVisibility(newSelection);
          }}
        />
      )}

      {isViewModalOpen && viewingSchedule && (
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
          }}
          onDelete={(deleteAllRecurring = false) => {
            handleScheduleDelete(viewingSchedule, deleteAllRecurring);
            setIsViewModalOpen(false);
            setViewingSchedule(null);
          }}
          onCopy={() => {
            console.log('📋 コピーボタンがクリックされました');
            console.log('  - viewingSchedule:', viewingSchedule);
            
            if (!viewingSchedule) {
              alert('コピーする予定が見つかりません');
              return;
            }
            
            // コピー情報を保持して編集モーダルを開く
            setCopiedSchedule(viewingSchedule);
            
            // コピー元の情報を保持した新規作成として編集モーダルを開く
            // 全ての項目をコピー元から取得して設定
            setEditingSchedule({
              ...viewingSchedule,
              id: '', // 新規作成として扱う
              isCopy: true,
              originalId: viewingSchedule.id,
              // 日時は現在日時をデフォルトとして設定（ユーザーが変更可能）
              startTime: new Date(),
              endTime: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
              // その他の項目はコピー元からそのまま使用
              type: viewingSchedule.type || '会議',
              title: viewingSchedule.title || '',
              details: viewingSchedule.details || '',
              description: viewingSchedule.description || '',
              location: viewingSchedule.location || '',
              participants: viewingSchedule.participants || [],
              equipment: viewingSchedule.equipment || [],
              meetingType: viewingSchedule.meetingType || 'offline',
              meetLink: '', // 新規作成時は空
              notes: viewingSchedule.notes || '',
              isAllDay: viewingSchedule.isAllDay || false,
              isMultiDay: viewingSchedule.isMultiDay || false,
              recurrence: null // コピー時は繰り返しを解除
            });
            setIsModalOpen(true);
            setIsViewModalOpen(false);
            console.log('  - 編集モーダルを開きました');
          }}
          onViewHistory={(scheduleId) => {
            setHistoryScheduleId(scheduleId);
            setIsHistoryModalOpen(true);
          }}
        />
      )}

      {isEmailModalOpen && newlyCreatedSchedule && (
        <EmailSendModal
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            setNewlyCreatedSchedule(null);
          }}
          schedule={newlyCreatedSchedule}
          onEmailSent={() => {
            // メール送信後にメール送信状態を再取得
            if (schedules && schedules.length > 0) {
              fetchMeetEmailStatuses(schedules);
            }
          }}
        />
      )}

      {isHistoryModalOpen && historyScheduleId && (
        <ScheduleHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => {
            setIsHistoryModalOpen(false);
            setHistoryScheduleId(null);
          }}
          scheduleId={historyScheduleId}
        />
      )}

      {/* コピー用日付選択モーダル */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">コピー先の日付を選択</h3>
            </div>
            <div className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  コピー先の日付
                </label>
                <input
                  type="date"
                  value={copyTargetDate ? format(copyTargetDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    console.log('📅 日付が変更されました:', e.target.value);
                    const newDate = new Date(e.target.value);
                    setCopyTargetDate(newDate);
                    console.log('  - 新しい日付:', newDate);
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div className="text-sm text-gray-600 mb-4">
                <p>元の予定: {copyingSchedule?.title}</p>
                <p>元の日時: {copyingSchedule?.startTime ? format(new Date(copyingSchedule.startTime), 'yyyy年M月d日 HH:mm', { locale: ja }) : ''}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCopyModal(false);
                  setCopyTargetDate(null);
                  setCopyingSchedule(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  console.log('🚀 コピーボタンがクリックされました');
                  console.log('  - copyTargetDate:', copyTargetDate);
                  console.log('  - copyTargetDate type:', typeof copyTargetDate);
                  handleScheduleCopy();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                コピー
              </button>
            </div>
          </div>
        </div>
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