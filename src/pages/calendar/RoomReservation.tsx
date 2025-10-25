import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, isToday, isSameMonth, isSameDay, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, DoorOpen, Calendar, Video, Mail, MailCheck, User, X } from 'lucide-react';
import { useCalendar } from '../../contexts/CalendarContext';
import { useAuth } from '../../contexts/AuthContext';
import { mockRooms } from '../../data/mockData';
import { Room } from '../../types';
import { supabase } from '../../lib/supabase';
import ReservationModal from '../../components/ReservationModal';
import EmailSendModal from '../../components/EmailSendModal';
import ScheduleTooltip from '../../components/ScheduleTooltip';
import ScheduleViewModal from '../../components/ScheduleViewModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { googleCalendarSyncService } from '../../services/googleCalendarSyncService';
import { scheduleNotificationService } from '../../services/scheduleNotificationService';
import { HolidayService } from '../../services/holidayService';
import { LeaveRequestService } from '../../services/leaveRequestService';
import { getEmailSentStatuses } from '../../utils/emailTracking';
import { getFinalScheduleStyles } from '../../utils/scheduleColors';
import { useConfirmation } from '../../hooks/useConfirmation';

export default function RoomReservation() {
  const { currentUser } = useAuth();
  const { confirm, confirmationState, handleConfirm, handleCancel } = useConfirmation();
  const { 
    currentDate, 
    setCurrentDate,
    view, 
    setView, 
    goToNextPeriod, 
    goToPreviousPeriod, 
    goToToday,
    goToTodayTriggered,
    setGoToTodayTriggered,
    getSchedulesForEquipment,
    getSchedulesForDateRange,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    refreshSchedules
  } = useCalendar();

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
  
  // goToTodayが呼ばれたときに週表示の開始日も更新
  useEffect(() => {
    if (view === 'week' && goToTodayTriggered) {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setHours(0, 0, 0, 0);
      setWeekStartDate(weekStart);
      // フラグをリセット
      setGoToTodayTriggered(false);
    }
  }, [goToTodayTriggered, view]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<{ id: string; name: string; type: 'room' } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // 祝日・休日データ
  const [holidays, setHolidays] = useState<Map<string, { name: string; type: string }>>(new Map());
  
  // 休暇申請データ
  const [leaveRequests, setLeaveRequests] = useState<Map<string, { userId: string; reason: string; type: string }>>(new Map());
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newlyCreatedSchedule, setNewlyCreatedSchedule] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSchedule, setViewingSchedule] = useState<any>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState<string>('');
  const [copiedSchedule, setCopiedSchedule] = useState<any>(null);

  // Load rooms and users from Supabase
  useEffect(() => {
    fetchRooms();
    fetchUsers();
  }, []);

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

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('display_order, name');
      
      if (error) {
        console.error('Error fetching rooms:', error);
        setRooms(mockRooms);
      } else {
        console.log('🏢 Fetched rooms:', data?.length || 0, 'rooms');
        if (data && data.length > 0) {
          console.log('🏢 Room IDs:', data.map(r => ({ id: r.id, name: r.name })));
        }
        setRooms(data || []);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setRooms(mockRooms);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, employee_id')
        .order('name');
      
      if (error) {
        console.error('Error fetching users:', error);
      } else {
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
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

  const goToTodayWeek = () => {
    const today = new Date();
    setCurrentDate(today);
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

  const dates = getDatesForView();

  const [emailStatuses, setEmailStatuses] = useState<Record<string, boolean>>({});
  const [meetEmailSentStatuses, setMeetEmailSentStatuses] = useState<Record<string, boolean>>({});
  
  // Google Meet URLメールの送信状態を取得
  const fetchMeetEmailStatuses = async (scheduleList: any[]) => {
    try {
      const meetSchedules = scheduleList.filter(s => s.meet_link);
      if (meetSchedules.length === 0) {
        console.log('📧 Google Meet URLを持つスケジュールがありません');
        return;
      }
      
      console.log('📧 Google Meet URLメール送信状態を取得中...', {
        meetSchedulesCount: meetSchedules.length,
        scheduleIds: meetSchedules.map(s => s.id)
      });
      
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
        console.log('✅ メール送信履歴を取得しました:', data);
        const statuses: Record<string, boolean> = {};
        data?.forEach(item => {
          statuses[item.schedule_id] = true;
          console.log(`  - スケジュール ${item.schedule_id}: ${item.sender_name} が ${item.sent_at} に送信`);
        });
        setMeetEmailSentStatuses(statuses);
        console.log('📧 メール送信状態を更新しました:', statuses);
      }
    } catch (error) {
      console.error('❌ メール送信状態取得中のエラー:', error);
    }
  };

  // カレンダー全体の表示範囲を計算
  const getCalendarDateRange = () => {
    switch (view) {
      case 'day':
        return { startDate: currentDate, endDate: addDays(currentDate, 1) };
      case 'week':
        // 週表示: currentDateを基準に7日間の範囲を計算
        return { startDate: currentDate, endDate: addDays(currentDate, 7) };
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
  
  const getRoomSchedulesForDay = (roomId: string, date: Date) => {
    console.log('🔍 getRoomSchedulesForDay called:', { roomId, date, totalSchedules: allSchedulesInView.length });
    
    return allSchedulesInView
      .filter(schedule => {
        // 複数日予約の場合は期間内の全日を表示、単日予約の場合は開始日のみ
        const scheduleStart = new Date(schedule.startTime);
        const scheduleEnd = new Date(schedule.endTime);
        const targetDate = new Date(date);
        
        // 時刻部分をリセットして日付のみで比較
        scheduleStart.setHours(0, 0, 0, 0);
        scheduleEnd.setHours(23, 59, 59, 999);
        targetDate.setHours(12, 0, 0, 0);
        
        // 単日スケジュールまたは複数日スケジュールの範囲内かチェック
        const dateMatch = targetDate >= scheduleStart && targetDate <= scheduleEnd;
        
        // 会議室が指定されているスケジュールのみ表示
        const hasRoom = schedule.equipment?.some((eq: any) => eq.id === roomId && eq.type === 'room');
        
        // デバッグログ
        if (dateMatch) {
          console.log(`📅 ${schedule.title} | Equipment: ${schedule.equipment?.map((eq: any) => `${eq.id}(${eq.type})`).join(', ') || 'none'} | HasRoom: ${hasRoom} | RoomID: ${roomId}`);
        }
        
        return dateMatch && hasRoom;
      })
      .sort((a, b) => {
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

  // スケジュールの背景色を取得する関数
  const getScheduleColorClasses = (schedule: Schedule): { bg: string, text: string, border: string } => {
    const styles = getFinalScheduleStyles(schedule);
    
    // 繰り返し予約のデバッグログ
    if (schedule.original_id || (schedule.recurrence && schedule.recurrence.frequency !== 'none')) {
      console.log('🔄 会議室表示 - 繰り返し予約:', {
        title: schedule.title,
        original_id: schedule.original_id,
        recurrence: schedule.recurrence,
        bgColor: styles.bgColor
      });
    }
    
    return {
      bg: `${styles.bgColor} ${styles.hoverBg}`,
      text: styles.textColor,
      border: styles.borderColor
    };
  };

  const handleCellClick = (room: { id: string; name: string }, date: Date) => {
    setSelectedRoom({ id: room.id, name: room.name, type: 'room' });
    setSelectedDate(date);
    setEditingSchedule(null); // Clear editing schedule for new reservation
    setIsModalOpen(true);
  };

  const handleScheduleClick = (schedule: any) => {
    setViewingSchedule(schedule);
    setIsViewModalOpen(true);
    setShowCopyModal(false); // コピーモーダルを確実に閉じる
  };

  const handleScheduleCopy = (schedule: any) => {
    setViewingSchedule(schedule);
    setShowCopyModal(true);
    setIsViewModalOpen(false);
  };

  const handleScheduleDelete = async (schedule: any, deleteAllRecurring: boolean = false) => {
    if (!schedule?.id) return;

    try {
      console.log('🗑️ 削除処理開始:', {
        schedule: schedule,
        deleteAllRecurring: deleteAllRecurring,
        original_id: schedule.original_id
      });

      // CalendarContextのdeleteSchedule関数を使用
      await deleteSchedule(schedule.id, currentUser?.id, undefined, deleteAllRecurring);
      
      console.log('✅ 削除成功');
    } catch (error) {
      console.error('削除エラー:', error);
      alert(`削除に失敗しました: ${error}`);
    }
  };

  const handleReservationSubmit = async (scheduleData: any) => {
    console.log('🎯 === handleReservationSubmit呼び出し ===');
    console.log('🔍 受信データ:', scheduleData);
    console.log('🔍 isCopy?:', scheduleData.isCopy);
    console.log('🔍 editingSchedule:', editingSchedule);
    console.log('🔍 呼び出し元スタック:', new Error().stack);
    
    try {
      // 削除処理
      if (scheduleData._delete && editingSchedule) {
        console.log('🗑️ 削除処理を実行');
        // 繰り返し予約の個別インスタンスの場合は元のIDを使用
        const scheduleId = editingSchedule.originalId || editingSchedule.id;
        
        // 新しいシンプルな同期方式では個別削除は不要
        // 次回同期時に自動的に反映される
        
        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('id', scheduleId);
        
        if (error) throw error;
        
        // 削除成功時はrefreshSchedulesを呼び出してデータを更新
        await refreshSchedules();
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
        return;
      }
      
      // 更新処理
      if (editingSchedule) {
        console.log('✏️ 更新処理を実行');
        
        // Googleカレンダーからの予定を編集した場合は新規登録扱いで上書き
        if (editingSchedule.isFromGoogleCalendar || editingSchedule.is_from_google_calendar) {
          console.log('🔄 Googleカレンダーからの予定を編集 - 新規登録扱いで上書き');
          
          // 元のスケジュールを削除
          const scheduleId = editingSchedule.originalId || editingSchedule.id;
          const { error: deleteError } = await supabase
            .from('schedules')
            .delete()
            .eq('id', scheduleId);
            
          if (deleteError) throw deleteError;
          
          // 新規作成として登録（isFromGoogleCalendarフラグを削除）
          const newScheduleData = {
            ...scheduleData,
            isFromGoogleCalendar: false,
            is_from_google_calendar: false,
            createdBy: currentUser?.id,
            createdAt: new Date(),
            updatedBy: null,
            updatedAt: null
          };
          
          const { error: insertError } = await supabase
            .from('schedules')
            .insert({
              type: newScheduleData.type,
              title: newScheduleData.title,
              details: newScheduleData.details,
              start_time: newScheduleData.startTime.toISOString(),
              end_time: newScheduleData.endTime.toISOString(),
              is_all_day: newScheduleData.isAllDay || false,
              is_multi_day: newScheduleData.isMultiDay || false,
              recurrence: newScheduleData.recurrence,
              participants: newScheduleData.participants,
              equipment: newScheduleData.equipment,
              reminders: newScheduleData.reminders,
              meet_link: newScheduleData.meetLink,
              meeting_type: newScheduleData.meetingType,
              created_by: newScheduleData.createdBy,
              created_at: newScheduleData.createdAt.toISOString(),
              is_from_google_calendar: false
            });
            
          if (insertError) throw insertError;
          
          await refreshSchedules();
          setIsModalOpen(false);
          setEditingSchedule(null);
          return;
        }
        
        // 通常の更新処理
        const scheduleId = editingSchedule.originalId || editingSchedule.id;
        
        // 種別が変更された場合はGoogleカレンダーフラグを削除
        const typeChanged = editingSchedule.type !== scheduleData.type;
        const updateData: any = {
          type: scheduleData.type,
          title: scheduleData.title,
          details: scheduleData.details,
          start_time: scheduleData.startTime.toISOString(),
          end_time: scheduleData.endTime.toISOString(),
          is_all_day: scheduleData.isAllDay || false,
          is_multi_day: scheduleData.isMultiDay || false,
          recurrence: scheduleData.recurrence,
          participants: scheduleData.participants,
          equipment: scheduleData.equipment,
          reminders: scheduleData.reminders,
          meet_link: scheduleData.meetLink,
          meeting_type: scheduleData.meetingType,
          updated_by: scheduleData.updatedBy,
          updated_at: new Date().toISOString()
        };
        
        // 種別が変更された場合はGoogleカレンダーフラグを削除
        if (typeChanged) {
          updateData.is_from_google_calendar = false;
        }
        
        const { error } = await supabase
          .from('schedules')
          .update(updateData)
          .eq('id', scheduleId);
          
        if (error) throw error;
        
        // Google Calendarを更新
        const updatedSchedule = {
          ...editingSchedule,
          ...scheduleData,
          updatedBy: scheduleData.updatedBy,
          updatedAt: new Date()
        };
        if (currentUser) {
          await googleCalendarSyncService.updateGoogleEvent(updatedSchedule, currentUser.id);
        }
        // refreshSchedules()を削除 - CalendarContextのupdateScheduleでローカル状態が更新されるため
        setIsModalOpen(false);
        setEditingSchedule(null);
      } else {
        // 新規作成処理（コピーも含む）
        console.log('✨ 新規作成処理を実行');
        console.log('  - Is copy?:', scheduleData.isCopy);
        console.log('  - Sample number:', scheduleData.sample_number);
        console.log('  - Title:', scheduleData.title);
        console.log('  - Production number:', scheduleData.production_number);
        console.log('  - Product code:', scheduleData.product_code);
        
        const { error } = await supabase
          .from('schedules')
          .insert([{
            type: scheduleData.type,
            title: scheduleData.title,
            details: scheduleData.details,
            start_time: scheduleData.startTime.toISOString(),
            end_time: scheduleData.endTime.toISOString(),
            is_all_day: scheduleData.isAllDay || false,
            is_multi_day: scheduleData.isMultiDay || false,
            recurrence: scheduleData.recurrence,
            participants: scheduleData.participants,
            equipment: scheduleData.equipment,
            reminders: scheduleData.reminders,
            meet_link: scheduleData.meetLink,
            meeting_type: scheduleData.meetingType,
            created_by: scheduleData.createdBy,
            quantity: scheduleData.quantity,
            assigned_to: scheduleData.assignedTo || scheduleData.assigned_to,
            notes: scheduleData.notes,
            // サンプル予約特有のフィールド
            production_number: scheduleData.production_number,
            product_code: scheduleData.product_code,
            sample_number: scheduleData.sample_number
          }]);
          
        if (error) {
          console.error('❌ DBエラー:', error);
          throw error;
        }
        
        console.log('✅ DBへの挿入成功');
        
        // 作成されたスケジュールを取得
        const { data: newData } = await supabase
          .from('schedules')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (newData) {
          const savedSchedule = {
            ...newData,
            startTime: new Date(newData.start_time),
            endTime: new Date(newData.end_time),
            createdAt: new Date(newData.created_at),
            updatedAt: new Date(newData.updated_at),
            meetingType: newData.meeting_type,
            isAllDay: newData.is_all_day,
            meetLink: newData.meet_link,
            createdBy: newData.created_by,
            updatedBy: newData.updated_by
          };
          // Google Calendarに同期
          if (currentUser) {
            await googleCalendarSyncService.createGoogleEvent(savedSchedule, currentUser.id);
          }
          
          // システム通知メールを送信（参加者がいる場合）
          if (scheduleData.participants && scheduleData.participants.length > 0 && scheduleData.sendEmailOnSave !== false) {
            console.log('=== 会議室予約作成通知メール送信開始 ===');
            const { data: participantsData } = await supabase
              .from('users')
              .select('id, name, email')
              .in('id', scheduleData.participants);
            
            if (participantsData && participantsData.length > 0) {
              try {
                const emailSent = await scheduleNotificationService.sendScheduleCreatedNotification(
                  savedSchedule,
                  participantsData,
                  currentUser?.name
                );
                if (emailSent) {
                  console.log('✅ 会議室予約作成通知メール送信成功');
                } else {
                  console.log('❌ 会議室予約作成通知メール送信失敗');
                }
              } catch (emailError) {
                console.error('会議室予約作成通知メール送信エラー:', emailError);
              }
            }
            console.log('=== 会議室予約作成通知メール送信完了 ===');
          }
          
          // メール送信確認（コピーの場合はスキップ）
          setNewlyCreatedSchedule(savedSchedule);
          if (!scheduleData.isCopy && scheduleData.meetingType === 'online' && scheduleData.meetLink) {
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
        
        await refreshSchedules();
        setIsModalOpen(false);
        setEditingSchedule(null);
      }
    } catch (error) {
      console.error('❌ エラー発生:', error);
      console.error('❌ エラー詳細:', {
        message: error.message,
        stack: error.stack,
        scheduleData: scheduleData
      });
      alert('会議室予約の保存に失敗しました: ' + error.message);
    }
    
    console.log('🎯 === handleReservationSubmit終了 ===');
  };

  // Render calendar content based on view
  const renderCalendarContent = () => {
    if (view === 'month') {
      return renderMonthView();
    } else {
      return renderTableView();
    }
  };

  const renderTableView = () => {
    return (
      <div className="overflow-x-auto relative" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th scope="col" className="w-64 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                会議室
              </th>
              {dates.map((date, i) => (
                <th key={i} scope="col" className="w-32 px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex flex-col items-center">
                    <span className="text-xs">{format(date, view === 'day' ? 'yyyy年M月d日 EEEE' : 'EEEE', { locale: ja })}</span>
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
                        return (
                          <div className="mt-1 text-xs px-1 py-0.5 rounded bg-orange-100 text-orange-700">
                            休暇
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rooms.map((room) => (
              <tr key={room.id}>
                <td className="w-64 px-4 py-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mt-1">
                      <DoorOpen className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{room.name}</div>
                    </div>
                  </div>
                </td>
                {dates.map((date, i) => {
                  const schedules = getRoomSchedulesForDay(room.id, date);
                  return (
                    <td 
                      key={i} 
                      className="w-32 px-2 py-2 text-sm text-gray-500 relative group border border-gray-100 align-top cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => handleCellClick(room, date)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellClick(room, date);
                        }}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-emerald-100 rounded-full p-1 z-10"
                      >
                        <Plus className="h-4 w-4 text-emerald-600" />
                      </button>
                      <div className={view === 'day' ? 'min-h-[120px]' : 'min-h-[80px] space-y-1'}>
                        {schedules.map(schedule => {
                          const colors = getScheduleColorClasses(schedule);
                          const isMultiDay = schedule.is_multi_day || (new Date(schedule.end_time).toDateString() !== new Date(schedule.start_time).toDateString());
                          const isStartDay = new Date(schedule.start_time).toDateString() === date.toDateString();
                          const isEndDay = new Date(schedule.end_time).toDateString() === date.toDateString();
                          
                          // 複数日予約の日数計算
                          const duration = isMultiDay ? Math.ceil((new Date(schedule.end_time).getTime() - new Date(schedule.start_time).getTime()) / (1000 * 60 * 60 * 24)) : 1;
                          const dayPosition = isMultiDay ? Math.ceil((date.getTime() - new Date(schedule.start_time).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1;
                          
                          return (
                            <ScheduleTooltip
                              key={schedule.id}
                              title={schedule.title}
                              participants={getParticipantNamesForTooltip(schedule.participants || [])}
                              details={schedule.details}
                            >
                              <div 
                                className={`mb-1 px-1 py-1 rounded text-xs ${colors.bg} ${colors.text} border-l-2 ${colors.border} cursor-pointer`}
                                onClick={(e) => { e.stopPropagation(); handleScheduleClick(schedule); }}
                              >
                              {isMultiDay && !isStartDay ? (
                                // 継続日の簡略表示
                                <div className="space-y-1">
                                  <div className="text-[10px] font-medium opacity-70 truncate">
                                    ← 継続 ({dayPosition}/{duration}日目)
                                  </div>
                                  <div className="font-medium truncate text-xs">
                                    {schedule.title}
                                  </div>
                                  {schedule.type && schedule.type !== 'default' && (
                                    <div className="text-[10px] opacity-70 truncate">
                                      種別: {schedule.type}
                                    </div>
                                  )}
                                  {schedule.participants && schedule.participants.length > 0 && (
                                    <div className="text-[10px] opacity-75 truncate">
                                      参加者: {getParticipantNames(schedule.participants, 50)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // 開始日または単日の通常表示
                                <>
                                  <div className="font-medium flex items-center justify-between">
                                    <span className="truncate text-xs flex items-center gap-1">
                                      {(schedule.isFromGoogleCalendar || schedule.is_from_google_calendar) && (
                                        <span className="text-xs" title="Googleカレンダーからの入力">📅</span>
                                      )}
                                      {schedule.is_all_day
                                        ? '終日'
                                        : isMultiDay 
                                          ? `${format(new Date(schedule.start_time), 'M/d')}〜${format(new Date(schedule.end_time), 'M/d')}`
                                          : `${format(schedule.startTime, 'HH:mm')}-${format(schedule.endTime, 'HH:mm')}`
                                      }
                                      {isMultiDay && (
                                        <span className="text-[9px] font-medium opacity-70 ml-1">
                                          ({duration}日間)
                                        </span>
                                      )}
                                    </span>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {(schedule.meetingType === 'online' || schedule.meeting_type === 'online' || schedule.meet_link) && (
                                        <>
                                          <Video className="h-3 w-3 text-purple-600" />
                                          {schedule.meet_link && meetEmailSentStatuses[schedule.id] ? (
                                            <Mail className="h-3 w-3 text-red-600" title="Google Meet URLメール送信済み" />
                                          ) : emailStatuses[schedule.id] ? (
                                            <MailCheck className="h-3 w-3 text-green-600" title="メール送信済み" />
                                          ) : (
                                            <Mail className="h-3 w-3 text-gray-400" title="メール未送信" />
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="truncate text-xs">{schedule.title}</div>
                                  {schedule.type && schedule.type !== 'default' && (
                                    <div className="text-[10px] opacity-70 truncate">
                                      種別: {schedule.type}
                                    </div>
                                  )}
                                  {schedule.participants && schedule.participants.length > 0 && (
                                    <div className="text-[10px] opacity-75 truncate">
                                      参加者: {getParticipantNames(schedule.participants, 50)}
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
  };

  const renderMonthView = () => {
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
              const daySchedules = rooms.flatMap(room => 
                getRoomSchedulesForDay(room.id, date)
              );
              
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
                        return (
                          <div className="text-xs px-1 py-0.5 rounded mb-1 bg-orange-100 text-orange-700">
                            休暇
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="space-y-1">
                    {daySchedules.slice(0, 3).map(schedule => {
                      const room = rooms.find(r => 
                        schedule.equipment?.some((eq: any) => eq.id === r.id && eq.type === 'room')
                      );
                      const colors = getScheduleColorClasses(schedule);
                      return (
                        <div 
                          key={schedule.id}
                          onClick={(e) => { e.stopPropagation(); handleScheduleClick(schedule); }}
                          className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer ${colors.bg} ${colors.text}`}
                        >
                          <div className="flex items-center space-x-1">
                            {(schedule.meetingType === 'online' || schedule.meeting_type === 'online' || schedule.meet_link) ? (
                              <>
                                <Video className="h-3 w-3 flex-shrink-0 text-purple-600" />
                                {schedule.meet_link && meetEmailSentStatuses[schedule.id] ? (
                                  <Mail className="h-3 w-3 flex-shrink-0 text-red-600" title="Google Meet URLメール送信済み" />
                                ) : emailStatuses[schedule.id] ? (
                                  <MailCheck className="h-3 w-3 flex-shrink-0 text-green-600" title="メール送信済み" />
                                ) : (
                                  <Mail className="h-3 w-3 flex-shrink-0 text-gray-400" title="メール未送信" />
                                )}
                              </>
                            ) : (
                              <DoorOpen className="h-3 w-3 flex-shrink-0 text-emerald-600" />
                            )}
                            {schedule.isFromGoogleCalendar && (
                              <span className="text-xs" title="Googleカレンダーからの入力">📅</span>
                            )}
                            <span className="truncate">{schedule.title}</span>
                          </div>
                          {schedule.type && schedule.type !== 'default' && (
                            <div className="text-[10px] opacity-70 truncate">
                              種別: {schedule.type}
                            </div>
                          )}
                          <div className="text-xs opacity-80 truncate mt-1">
                            {getParticipantNames(schedule.participants || [])}
                          </div>
                        </div>
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">会議室予約</h1>
        <button
          onClick={() => {
            setSelectedRoom(null);
            setSelectedDate(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
        >
          <Plus className="h-5 w-5 mr-1" />
          予約作成
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
              {view === 'week' ? (
                <div className="inline-flex rounded-md shadow-sm">
                  <button
                    type="button"
                    onClick={goToPreviousWeek}
                    className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    先週
                  </button>
                  <button
                    type="button"
                    onClick={goToPreviousDay}
                    className="relative inline-flex items-center px-3 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    前の日
                  </button>
                  <button
                    type="button"
                    onClick={goToTodayWeek}
                    className="relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    今日
                  </button>
                  <button
                    type="button"
                    onClick={goToNextDay}
                    className="relative inline-flex items-center px-3 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    次の日
                  </button>
                  <button
                    type="button"
                    onClick={goToNextWeek}
                    className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    来週
                  </button>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>

        {renderCalendarContent()}
      </div>

      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSchedule(null);
          setSelectedRoom(null);
          setSelectedDate(null);
        }}
        onSubmit={handleReservationSubmit}
        selectedDate={selectedDate || undefined}
        selectedEquipment={selectedRoom || undefined}
        type={editingSchedule?.type === 'サンプル作成' ? 'sample' : 'general'}
        editingSchedule={editingSchedule}
      />

      {newlyCreatedSchedule && (
        <EmailSendModal
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            setNewlyCreatedSchedule(null);
            // メール送信後に状態を更新
            refreshSchedules();
          }}
          schedule={newlyCreatedSchedule}
          users={users}
          onEmailSent={() => {
            // メール送信後にメール送信状態を再取得
            if (allSchedulesInView && allSchedulesInView.length > 0) {
              fetchMeetEmailStatuses(allSchedulesInView);
            }
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
        />
      )}

      {/* コピー先日付選択モーダル */}
      {showCopyModal && viewingSchedule && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                予約をコピー
              </h3>
              <button onClick={() => setShowCopyModal(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                コピー先の日付を選択してください
              </label>
              <input
                type="date"
                value={copyTargetDate}
                onChange={(e) => setCopyTargetDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            
            {copyTargetDate && (
              <div className="mb-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  コピー先日付: {format(new Date(copyTargetDate + 'T00:00:00'), 'yyyy年M月d日', { locale: ja })}
                </p>
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  if (!copyTargetDate) {
                    alert('コピー先の日付を選択してください');
                    return;
                  }
                  
                  try {
                    // コピー用のスケジュールデータを作成
                    const originalStartTime = new Date(viewingSchedule.startTime);
                    const originalEndTime = new Date(viewingSchedule.endTime);
                    const targetDate = new Date(copyTargetDate + 'T00:00:00');
                    
                    // 時間を保持して日付のみ変更
                    const newStartTime = new Date(targetDate);
                    newStartTime.setHours(originalStartTime.getHours(), originalStartTime.getMinutes(), 0, 0);
                    
                    const newEndTime = new Date(targetDate);
                    newEndTime.setHours(originalEndTime.getHours(), originalEndTime.getMinutes(), 0, 0);
                    
                    const copiedScheduleData = {
                      title: `${viewingSchedule.title} (コピー)`,
                      start_time: newStartTime.toISOString(),
                      end_time: newEndTime.toISOString(),
                      participants: viewingSchedule.participants || [],
                      equipment: viewingSchedule.equipment || [],
                      details: viewingSchedule.details || '',
                      notes: viewingSchedule.notes || '',
                      type: viewingSchedule.type || 'default',
                      meeting_type: viewingSchedule.meetingType || viewingSchedule.meeting_type || 'offline',
                      meet_link: viewingSchedule.meetLink || viewingSchedule.meet_link || '',
                      is_all_day: viewingSchedule.isAllDay || viewingSchedule.is_all_day || false,
                      is_multi_day: viewingSchedule.isMultiDay || viewingSchedule.is_multi_day || false,
                      recurrence: null, // コピー時は繰り返しを解除
                      created_by: currentUser?.id
                    };

                    // データベースに保存
                    const { data, error } = await supabase
                      .from('schedules')
                      .insert([copiedScheduleData])
                      .select();

                    if (error) {
                      console.error('コピーエラー:', error);
                      alert('コピーに失敗しました');
                      return;
                    }

                    // スケジュール一覧を更新
                    await refreshSchedules();
                    alert('コピーしました');
                    
                    // モーダルを閉じる
                    setShowCopyModal(false);
                    setCopyTargetDate('');
                    setViewingSchedule(null);
                    setIsViewModalOpen(false);
                    
                  } catch (error) {
                    console.error('コピーエラー:', error);
                    alert('コピーに失敗しました');
                  }
                }}
                disabled={!copyTargetDate}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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