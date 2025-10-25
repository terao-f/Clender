import { useState, useEffect, useMemo } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, isToday, isSameMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Box, ArrowDownUp, X, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { mockSampleEquipment } from '../../data/mockData';
import { Schedule, SampleEquipment } from '../../types';
import { supabase } from '../../lib/supabase';
import ReservationModal from '../../components/ReservationModal';
import EmailSendModal from '../../components/EmailSendModal';
import ScheduleViewModal from '../../components/ScheduleViewModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmation } from '../../hooks/useConfirmation';
import { scheduleNotificationService } from '../../services/scheduleNotificationService';
import { HolidayService } from '../../services/holidayService';
import { LeaveRequestService } from '../../services/leaveRequestService';
import toast from 'react-hot-toast';

export default function SampleReservation() {
  const { currentUser } = useAuth();
  const { confirm, confirmationState, handleConfirm, handleCancel } = useConfirmation();
  
  // 独立したカレンダーの状態管理
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<{ id: string; name?: string; type: 'sample' } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [sampleEquipment, setSampleEquipment] = useState<SampleEquipment[]>([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedDateForOrder, setSelectedDateForOrder] = useState<Date | null>(null);
  const [selectedEquipmentForOrder, setSelectedEquipmentForOrder] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingSchedule, setViewingSchedule] = useState<Schedule | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; schedule: any } | null>(null);
  const [copiedSchedule, setCopiedSchedule] = useState<any | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newlyCreatedSchedule, setNewlyCreatedSchedule] = useState<any>(null);
  
  // デバッグ用
  useEffect(() => {
    if (contextMenu) {
      console.log('Sample reservation context menu state updated:', contextMenu);
    }
  }, [contextMenu]);
  
  // 指定日の指定設備の連番を再計算する関数
  const recalculateOrderNumbers = async (date: Date, equipmentId: string) => {
    console.log('🔄 連番再計算開始');
    console.log('  - 日付:', format(date, 'yyyy-MM-dd'));
    console.log('  - 設備ID:', equipmentId);
    
    const startDateStr = format(date, 'yyyy-MM-dd');
    
    // その日のすべての予約を取得（equipment情報も含む）
    const { data: schedules, error: fetchError } = await supabase
      .from('schedules')
      .select('*')
      .gte('start_time', `${startDateStr}T00:00:00.000Z`)
      .lte('start_time', `${startDateStr}T23:59:59.999Z`)
      .order('created_at', { ascending: true });
    
    if (fetchError) {
      console.error('予約取得エラー:', fetchError);
      return;
    }
    
    // 指定設備の予約のみフィルタリング
    const targetSchedules = schedules?.filter(schedule => {
      return schedule.equipment?.some((eq: any) => eq.id === equipmentId && eq.type === 'sample');
    }) || [];
    
    console.log('  - 対象予約数:', targetSchedules.length);
    
    // 連番を振り直す（1から順番に）
    for (let i = 0; i < targetSchedules.length; i++) {
      const newOrderNumber = i + 1;
      console.log(`  - 更新: ${targetSchedules[i].title} -> 順番${newOrderNumber}`);
      
      const { error: updateError } = await supabase
        .from('schedules')
        .update({ order_number: newOrderNumber })
        .eq('id', targetSchedules[i].id);
      
      if (updateError) {
        console.error(`連番更新エラー (ID: ${targetSchedules[i].id}):`, updateError);
      }
    }
    
    console.log('✅ 連番再計算完了:', targetSchedules.length, '件');
  };

  // Load sample equipment from Supabase or fallback to mockSampleEquipment
  useEffect(() => {
    fetchSampleEquipment();
    fetchUsers();
  }, []);

  const fetchSampleEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('sample_equipment')
        .select('*')
        .order('display_order, name');
      
      if (error) {
        console.error('Error fetching sample equipment:', error);
        setSampleEquipment(mockSampleEquipment);
      } else {
        setSampleEquipment(data || []);
      }
    } catch (error) {
      console.error('Error fetching sample equipment:', error);
      console.log('Using mock sample equipment');
      setSampleEquipment(mockSampleEquipment);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, employee_id')
        .order('name');
      
      if (!error && data) {
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Week view specific navigation
  const goToPreviousWeek = () => {
    console.log('🔙 goToPreviousWeek called');
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    console.log('  - 元のcurrentDate:', format(currentDate, 'yyyy-MM-dd'));
    console.log('  - 新しいcurrentDate:', format(newDate, 'yyyy-MM-dd'));
    setCurrentDate(newDate);
  };
  
  const goToNextWeek = () => {
    console.log('🔜 goToNextWeek called');
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    console.log('  - 元のcurrentDate:', format(currentDate, 'yyyy-MM-dd'));
    console.log('  - 新しいcurrentDate:', format(newDate, 'yyyy-MM-dd'));
    setCurrentDate(newDate);
  };
  
  const goToPreviousDay = () => {
    console.log('⬅️ goToPreviousDay called');
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    console.log('  - 元のcurrentDate:', format(currentDate, 'yyyy-MM-dd'));
    console.log('  - 新しいcurrentDate:', format(newDate, 'yyyy-MM-dd'));
    setCurrentDate(newDate);
  };
  
  const goToNextDay = () => {
    console.log('➡️ goToNextDay called');
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    console.log('  - 元のcurrentDate:', format(currentDate, 'yyyy-MM-dd'));
    console.log('  - 新しいcurrentDate:', format(newDate, 'yyyy-MM-dd'));
    setCurrentDate(newDate);
  };

  const goToTodayWeek = () => {
    console.log('📅 goToTodayWeek called');
    const today = new Date();
    console.log('  - 今日の日付:', format(today, 'yyyy-MM-dd (E)', { locale: ja }));
    
    setCurrentDate(today);
  };
  
  // ナビゲーション関数
  const goToToday = () => {
    const today = new Date();
    console.log('📅 サンプル予約「今日」ボタン押下:');
    console.log('  - 今日の日付:', format(today, 'yyyy-MM-dd (E)', { locale: ja }));
    console.log('  - 現在のビュー:', view);
    console.log('  - 現在のweekStartDate:', format(weekStartDate, 'yyyy-MM-dd (E)', { locale: ja }));
    console.log('  - 現在のcurrentDate:', format(currentDate, 'yyyy-MM-dd (E)', { locale: ja }));
    
    setCurrentDate(today);
    
    // 週表示の場合は、今日の日付が週の最初に来るように調整
    if (view === 'week') {
      const dayOfWeek = today.getDay(); // 0=日曜日, 1=月曜日, ..., 6=土曜日
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 月曜日を週の始まりとする
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + mondayOffset);
      console.log('  - 新しい週開始日:', format(weekStart, 'yyyy-MM-dd (E)', { locale: ja }));
      setWeekStartDate(weekStart);
      
      // 新しい日付配列を計算して確認
      const newDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
      console.log('  - 新しい日付配列:', newDates.map(d => format(d, 'MM/dd (E)', { locale: ja })).join(', '));
      
      // 今日が何番目に来るかを確認
      const todayIndex = newDates.findIndex(d => isSameDay(d, today));
      console.log('  - 今日の位置:', todayIndex + 1, '番目');
    } else {
      setWeekStartDate(today);
    }
  };
  
  const goToPreviousPeriod = () => {
    console.log('🔙 goToPreviousPeriod called, view:', view);
    const newDate = new Date(currentDate);
    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
    }
    console.log('  - 元のcurrentDate:', format(currentDate, 'yyyy-MM-dd'));
    console.log('  - 新しいcurrentDate:', format(newDate, 'yyyy-MM-dd'));
    setCurrentDate(newDate);
  };
  
  const goToNextPeriod = () => {
    console.log('🔜 goToNextPeriod called, view:', view);
    const newDate = new Date(currentDate);
    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
    }
    console.log('  - 元のcurrentDate:', format(currentDate, 'yyyy-MM-dd'));
    console.log('  - 新しいcurrentDate:', format(newDate, 'yyyy-MM-dd'));
    setCurrentDate(newDate);
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

  const dates = useMemo(() => {
    const result = getDatesForView();
    console.log('🔄 dates配列が再計算されました:');
    console.log('  - ビュー:', view);
    console.log('  - currentDate:', format(currentDate, 'yyyy-MM-dd (E)', { locale: ja }));
    console.log('  - weekStartDate:', format(weekStartDate, 'yyyy-MM-dd (E)', { locale: ja }));
    console.log('  - 日付配列:', result.map(d => format(d, 'MM/dd (E)', { locale: ja })).join(', '));
    return result;
  }, [view, currentDate, weekStartDate]);

  const [sampleSchedules, setSampleSchedules] = useState<any[]>([]);
  
  // 祝日・休日データ
  const [holidays, setHolidays] = useState<Map<string, { name: string; type: string }>>(new Map());
  
  // 休暇申請データ
  const [leaveRequests, setLeaveRequests] = useState<Map<string, { userId: string; reason: string; type: string }>>(new Map());
  
  
  // Load sample schedules
  useEffect(() => {
    fetchSampleSchedules();
  }, [currentDate, view, weekStartDate]); // weekStartDateも監視対象に追加

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
  
  const fetchSampleSchedules = async () => {
    try {
      // 最新のdatesを計算
      const currentDates = getDatesForView();
      if (currentDates.length === 0) return;
      
      // 日本時間として正しく処理するため、時刻を調整
      const startDate = new Date(currentDates[0]);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(currentDates[currentDates.length - 1]);
      endDate.setHours(23, 59, 59, 999);
      
      // ISOStringに変換（UTCとして扱われる）
      const startDateISO = startDate.toISOString();
      const endDateISO = endDate.toISOString();
      
      console.log('📅 サンプル予約取得:');
      console.log('  - ビュー:', view);
      console.log('  - weekStartDate:', format(weekStartDate, 'yyyy-MM-dd (E)', { locale: ja }));
      console.log('  - currentDate:', format(currentDate, 'yyyy-MM-dd (E)', { locale: ja }));
      console.log('  - 開始日時:', startDateISO);
      console.log('  - 終了日時:', endDateISO);
      console.log('  - 日付配列:', currentDates.map(d => format(d, 'MM/dd')).join(', '));
      
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .gte('start_time', startDateISO)
        .lte('start_time', endDateISO)
        .order('start_time');
        
      if (error) {
        console.error('Error fetching sample schedules:', error);
      } else {
        console.log('  - 取得件数:', data?.length || 0);
        if (data && data.length > 0) {
          console.log('  - 最初の予約:', data[0].title, format(new Date(data[0].start_time), 'yyyy-MM-dd'));
          console.log('  - 最後の予約:', data[data.length - 1].title, format(new Date(data[data.length - 1].start_time), 'yyyy-MM-dd'));
        }
        // データベースのフィールド名をフロントエンドで期待されるフィールド名にマッピング
        const mappedData = (data || []).map(schedule => ({
          ...schedule,
          createdBy: schedule.created_by,
          updatedBy: schedule.updated_by,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          createdAt: schedule.created_at,
          updatedAt: schedule.updated_at
        }));
        setSampleSchedules(mappedData);
      }
    } catch (error) {
      console.error('Error fetching sample schedules:', error);
    }
  };
  
  const getSampleSchedulesForDay = (equipmentId: string, date: Date) => {
    const targetDateStr = format(date, 'yyyy-MM-dd');
    
    const filtered = sampleSchedules
      .filter(schedule => {
        try {
          const scheduleStart = new Date(schedule.start_time);
          if (isNaN(scheduleStart.getTime())) {
            return false;
          }
          const scheduleStartStr = format(scheduleStart, 'yyyy-MM-dd');
          
          // 該当日の予約のみ表示（文字列比較で確実に）
          const isInRange = scheduleStartStr === targetDateStr;
          
          const equipmentMatch = schedule.equipment?.some((eq: any) => eq.id === equipmentId && eq.type === 'sample');
          
          if (isInRange && equipmentMatch) {
            console.log(`  ✓ 表示対象: ${schedule.title} (${scheduleStartStr})`);
          }
          
          return isInRange && equipmentMatch;
        } catch (error) {
          console.error('日付処理エラー:', schedule.title, error);
          return false;
        }
      })
      .map(schedule => ({
        ...schedule,
        startTime: new Date(schedule.start_time),
        endTime: new Date(schedule.end_time)
      }))
      .sort((a, b) => {
        // order_number（登録順）でソート
        return (a.order_number || 0) - (b.order_number || 0);
      });
    
    console.log(`📋 ${targetDateStr}の予約: ${filtered.length}件`);
    return filtered;
  };


  const handleReservationSubmit = async (scheduleData: any) => {
    console.log('🔍 === handleReservationSubmit呼び出し ===');
    console.log('📋 受信したスケジュールデータ:', scheduleData);
    console.log('📧 メール送信設定:');
    console.log('  - sendEmailOnSave:', scheduleData.sendEmailOnSave);
    console.log('  - participants:', scheduleData.participants);
    console.log('  - participants length:', scheduleData.participants?.length);
    console.log('📑 その他:');
    console.log('  - コピー？:', scheduleData.isCopy);
    console.log('  - 編集中？:', editingSchedule);
    
    try {
      // サンプル予約の場合、デフォルトの時間を設定
      if (!scheduleData.startTime || !scheduleData.endTime) {
        const defaultDate = selectedDate || new Date();
        scheduleData.startTime = new Date(defaultDate);
        scheduleData.startTime.setHours(9, 0, 0, 0);
        scheduleData.endTime = new Date(defaultDate);
        scheduleData.endTime.setHours(18, 0, 0, 0);
      }
      
      // typeが未設定の場合、サンプル作成をデフォルト値として設定
      if (!scheduleData.type) {
        scheduleData.type = 'サンプル作成';
      }
      
      // 削除処理
      if (scheduleData._delete && editingSchedule) {
        // 削除前に参加者情報を保存
        const participantsToNotify = editingSchedule.participants || [];
        
        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('id', editingSchedule.id);
        
        if (error) throw error;
        
        // 削除時のメール通知
        if (participantsToNotify.length > 0) {
          console.log('=== サンプル予約削除通知メール送信開始 ===');
          console.log('削除対象:', editingSchedule.title);
          console.log('参加者ID:', participantsToNotify);
          
          // 参加者情報を取得
          const { data: participantsData } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', participantsToNotify);
          
          if (participantsData && participantsData.length > 0) {
            try {
              const emailSent = await scheduleNotificationService.sendScheduleDeletedNotification(
                editingSchedule,
                participantsData,
                currentUser?.name
              );
              if (emailSent) {
                console.log('✅ サンプル予約削除通知メール送信成功');
              } else {
                console.log('❌ サンプル予約削除通知メール送信失敗');
              }
            } catch (emailError) {
              console.error('サンプル予約削除通知メール送信エラー:', emailError);
            }
          }
          console.log('=== サンプル予約削除通知メール送信完了 ===');
        }
        
        // 削除後、その日の連番を再計算
        if (editingSchedule.equipment && editingSchedule.equipment.length > 0) {
          for (const eq of editingSchedule.equipment) {
            if (eq.type === 'sample') {
              await recalculateOrderNumbers(editingSchedule.startTime, eq.id);
            }
          }
        }
        
        // 削除成功時はデータを更新
        await fetchSampleSchedules();
        setIsModalOpen(false);
        setEditingSchedule(null);
        return;
      }
      
      // 更新処理（コピーの場合はスキップ）
      if (editingSchedule && !scheduleData.isCopy) {
        // 日付が変更されているかチェック
        const oldDate = format(editingSchedule.startTime, 'yyyy-MM-dd');
        const newDate = format(scheduleData.startTime, 'yyyy-MM-dd');
        const dateChanged = oldDate !== newDate;
        
        const { error } = await supabase
          .from('schedules')
          .update({
            type: scheduleData.type,
            title: scheduleData.title,
            details: scheduleData.details,
            start_time: scheduleData.startTime?.toISOString(),
            end_time: scheduleData.endTime?.toISOString(),
            participants: scheduleData.participants,
            equipment: scheduleData.equipment,
            reminders: scheduleData.reminders,
            meet_link: scheduleData.meetLink,
            meeting_type: scheduleData.meetingType,
            updated_by: scheduleData.updatedBy,
            quantity: scheduleData.quantity,
            assigned_to: scheduleData.assignedTo,
            notes: scheduleData.notes,
            production_number: scheduleData.production_number,
            product_code: scheduleData.product_code
          })
          .eq('id', editingSchedule.id);
          
        if (error) throw error;
        
        // 操作履歴を記録
        try {
          const { error: historyError } = await supabase
            .from('schedule_history')
            .insert({
              schedule_id: editingSchedule.id,
              operation_type: 'update',
              operator_id: currentUser?.id || '',
              operator_name: currentUser?.name || '不明',
              description: `サンプル予約を更新しました: ${scheduleData.title}`,
              operation_time: new Date().toISOString(),
              schedule_data: {
                title: scheduleData.title,
                quantity: scheduleData.quantity,
                assigned_to: scheduleData.assignedTo,
                production_number: scheduleData.production_number,
                product_code: scheduleData.product_code
              }
            });
          
          if (historyError) {
            console.error('履歴記録エラー:', historyError);
          } else {
            console.log('✅ 操作履歴を記録しました');
          }
        } catch (historyError) {
          console.error('履歴記録でエラー:', historyError);
        }
        
        // 更新通知メールを送信
        if (scheduleData.participants && scheduleData.participants.length > 0) {
          console.log('=== サンプル予約更新通知メール送信開始 ===');
          const { data: participantsData } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', scheduleData.participants);
          
          if (participantsData && participantsData.length > 0) {
            try {
              // 更新されたスケジュールオブジェクトを作成
              const updatedSchedule = {
                ...editingSchedule,
                ...scheduleData
              };
              const emailSent = await scheduleNotificationService.sendScheduleUpdatedNotification(
                updatedSchedule,
                participantsData,
                currentUser?.name
              );
              if (emailSent) {
                console.log('✅ サンプル予約更新通知メール送信成功');
              } else {
                console.log('❌ サンプル予約更新通知メール送信失敗');
              }
            } catch (emailError) {
              console.error('サンプル予約更新通知メール送信エラー:', emailError);
            }
          }
          console.log('=== サンプル予約更新通知メール送信完了 ===');
        }
        
        // 日付が変更された場合、両方の日付で連番を再計算
        if (dateChanged && scheduleData.equipment && scheduleData.equipment.length > 0) {
          for (const eq of scheduleData.equipment) {
            if (eq.type === 'sample') {
              // 元の日付の連番を再計算
              await recalculateOrderNumbers(editingSchedule.startTime, eq.id);
              // 新しい日付の連番を再計算
              await recalculateOrderNumbers(scheduleData.startTime, eq.id);
            }
          }
        }
      } else {
        // 新規作成処理（コピーも含む）
        console.log('🚀 サンプル予約の新規作成/コピー処理開始');
        console.log('  - isCopy:', scheduleData.isCopy);
        console.log('  - sample_number:', scheduleData.sample_number);
        
        // まず同じ日付のサンプル予約をすべてカウント
        const startDateStr = format(scheduleData.startTime, 'yyyy-MM-dd');
        const { data: allSchedules, error: countError } = await supabase
          .from('schedules')
          .select('id, order_number, equipment, type')
          .gte('start_time', `${startDateStr}T00:00:00.000Z`)
          .lte('start_time', `${startDateStr}T23:59:59.999Z`)
          .order('order_number', { ascending: false });
        
        if (countError) throw countError;
        
        // サンプル予約のみをフィルタリング（設備タイプがsampleまたはtypeがサンプル系）
        const sampleSchedules = allSchedules?.filter(schedule => {
          // equipmentにsampleタイプがあるか、typeがサンプル系の予約をカウント
          const hasSampleEquipment = schedule.equipment?.some((eq: any) => eq.type === 'sample');
          const isSampleType = schedule.type?.includes('サンプル');
          return hasSampleEquipment || isSampleType;
        }) || [];
        
        // 1日最大10件の制限チェック（全サンプル予約の合計）
        // 既存が9件以上ある場合は新規登録不可（9件 + 新規1件 = 10件が上限）
        if (sampleSchedules && sampleSchedules.length >= 10) {
          toast.error('1日のサンプル予約数が上限（10件）に達しています。');
          return;
        }
        
        // 同じ設備の予約をフィルタリング
        const existingSchedules = allSchedules?.filter(schedule => {
          if (!schedule.equipment || !scheduleData.equipment) return false;
          return schedule.equipment.some((eq: any) => 
            scheduleData.equipment.some((targetEq: any) => 
              eq.id === targetEq.id && eq.type === targetEq.type
            )
          );
        }) || [];
        
        // その日の設備ごとの予約数をカウントして、次の番号を設定
        const newOrderNumber = existingSchedules.length + 1;
        
        // order_numberは常にその日の順番（新規作成でもコピーでも同じ）
        console.log('📝 DBに保存するデータ:');
        console.log('  - title:', scheduleData.title);
        console.log('  - order_number:', newOrderNumber, '（その日の順番）');
        console.log('  - sample_number:', scheduleData.sample_number, '（コピー時のみ使用）');
        console.log('  - production_number:', scheduleData.production_number);
        console.log('  - product_code:', scheduleData.product_code);
        
        const { error } = await supabase
          .from('schedules')
          .insert([{
            type: scheduleData.type,
            title: scheduleData.title,
            details: scheduleData.details,
            start_time: scheduleData.startTime?.toISOString(),
            end_time: scheduleData.endTime?.toISOString(),
            participants: scheduleData.participants,
            equipment: scheduleData.equipment,
            reminders: scheduleData.reminders,
            meet_link: scheduleData.meetLink,
            meeting_type: scheduleData.meetingType,
            created_by: scheduleData.createdBy,
            quantity: scheduleData.quantity,
            assigned_to: scheduleData.assignedTo || scheduleData.assigned_to,
            notes: scheduleData.notes,
            order_number: newOrderNumber,
            production_number: scheduleData.production_number,
            product_code: scheduleData.product_code,
            sample_number: scheduleData.sample_number
          }]);
          
        if (error) throw error;
        
        // 新規作成されたスケジュールのIDを取得して履歴を記録
        const { data: newSchedule } = await supabase
          .from('schedules')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (newSchedule) {
          // 操作履歴を記録
          try {
            const { error: historyError } = await supabase
              .from('schedule_history')
              .insert({
                schedule_id: newSchedule.id,
                operation_type: 'create',
                operator_id: currentUser?.id || '',
                operator_name: currentUser?.name || '不明',
                description: `サンプル予約を作成しました: ${scheduleData.title}`,
                operation_time: new Date().toISOString(),
                schedule_data: {
                  title: scheduleData.title,
                  quantity: scheduleData.quantity,
                  assigned_to: scheduleData.assignedTo,
                  production_number: scheduleData.production_number,
                  product_code: scheduleData.product_code,
                  order_number: newOrderNumber
                }
              });
            
            if (historyError) {
              console.error('履歴記録エラー:', historyError);
            } else {
              console.log('✅ 操作履歴を記録しました');
            }
          } catch (historyError) {
            console.error('履歴記録でエラー:', historyError);
          }
        }
        
        // システム通知メールを送信（参加者がいる場合）
        if (scheduleData.participants && scheduleData.participants.length > 0 && scheduleData.sendEmailOnSave !== false) {
          console.log('=== サンプル予約作成通知メール送信開始 ===');
          const { data: participantsData } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', scheduleData.participants);
          
          if (participantsData && participantsData.length > 0) {
            try {
              // 新規作成されたスケジュールのIDを取得
              const { data: newSchedule } = await supabase
                .from('schedules')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
              
              if (newSchedule) {
                const createdSchedule = {
                  ...newSchedule,
                  startTime: new Date(newSchedule.start_time),
                  endTime: new Date(newSchedule.end_time),
                  createdAt: new Date(newSchedule.created_at)
                };
                
                const emailSent = await scheduleNotificationService.sendScheduleCreatedNotification(
                  createdSchedule,
                  participantsData,
                  currentUser?.name
                );
                if (emailSent) {
                  console.log('✅ サンプル予約作成通知メール送信成功');
                } else {
                  console.log('❌ サンプル予約作成通知メール送信失敗');
                }
              }
            } catch (emailError) {
              console.error('サンプル予約作成通知メール送信エラー:', emailError);
            }
          }
          console.log('=== サンプル予約作成通知メール送信完了 ===');
        }
      }
      
      // 作成・更新されたスケジュールを取得
      let savedSchedule: Schedule | null = null;
      
      if (editingSchedule) {
        // 更新の場合
        const { data: updatedData } = await supabase
          .from('schedules')
          .select('*')
          .eq('id', editingSchedule.id)
          .single();
          
        if (updatedData) {
          savedSchedule = {
            ...updatedData,
            startTime: new Date(updatedData.start_time),
            endTime: new Date(updatedData.end_time),
            createdAt: new Date(updatedData.created_at),
            updatedAt: new Date(updatedData.updated_at)
          };
        }
      } else {
        // 新規作成の場合、最新のスケジュールを取得
        const { data: newData } = await supabase
          .from('schedules')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (newData) {
          savedSchedule = {
            ...newData,
            startTime: new Date(newData.start_time),
            endTime: new Date(newData.end_time),
            createdAt: new Date(newData.created_at),
            updatedAt: new Date(newData.updated_at)
          };
        }
      }
      
      // 予約作成後、その日の連番を再計算
      if (scheduleData.equipment && scheduleData.equipment.length > 0) {
        for (const eq of scheduleData.equipment) {
          if (eq.type === 'sample') {
            await recalculateOrderNumbers(scheduleData.startTime, eq.id);
          }
        }
      }
      
      // オンライン会議形式の場合のみ確認ポップアップを表示
      if (savedSchedule && savedSchedule.meetingType === 'online' && savedSchedule.meetLink) {
        const confirmed = await confirm({
          title: 'Google Meet URL送信',
          message: 'オンライン会議が選択されました、顧客にGoogleMeetURLをメールで送信しますか？',
          confirmText: '送信する',
          cancelText: '送信しない',
          type: 'info'
        });
        
        if (confirmed) {
          setNewlyCreatedSchedule(savedSchedule);
          setIsEmailModalOpen(true);
        }
      }
      
      // Refresh the schedules to show new data
      await fetchSampleSchedules();
      setIsModalOpen(false);
      setEditingSchedule(null);
    } catch (error: any) {
      console.error('Error saving sample reservation:', error);
      toast.error('サンプル予約の保存に失敗しました。もう一度お試しください。');
    }
  };

  // Sort orders modal component
  const SortOrderModal = ({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved?: () => void }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load orders for the selected date and equipment
    useEffect(() => {
      if (isOpen && selectedDateForOrder && selectedEquipmentForOrder) {
        loadOrders();
      }
    }, [isOpen, selectedDateForOrder, selectedEquipmentForOrder]);

    const loadOrders = async () => {
      if (!selectedDateForOrder || !selectedEquipmentForOrder) return;
      
      setIsLoading(true);
      try {
        const startDate = format(selectedDateForOrder, 'yyyy-MM-dd');
        const { data, error } = await supabase
          .from('schedules')
          .select('*')
          .gte('start_time', `${startDate}T00:00:00.000Z`)
          .lte('start_time', `${startDate}T23:59:59.999Z`)
          .order('start_time');
          
        if (error) throw error;
        
        // Filter for sample schedules with the selected equipment
        const filteredOrders = (data || []).filter(schedule => 
          schedule.equipment?.some((eq: any) => eq.id === selectedEquipmentForOrder && eq.type === 'sample')
        );
        
        // order_numberの順番でソート
        const sortedOrders = filteredOrders.sort((a, b) => (a.order_number || 0) - (b.order_number || 0));
        setOrders(sortedOrders.map((order, index) => ({ ...order, displayOrder: index + 1 })));
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const moveOrder = (index: number, direction: 'up' | 'down') => {
      const newOrders = [...orders];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (newIndex < 0 || newIndex >= newOrders.length) return;
      
      [newOrders[index], newOrders[newIndex]] = [newOrders[newIndex], newOrders[index]];
      newOrders[index].displayOrder = index + 1;
      newOrders[newIndex].displayOrder = newIndex + 1;
      
      setOrders(newOrders);
    };

    const saveOrder = async () => {
      try {
        setIsLoading(true);
        
        // Update each order with new sequence
        const updatePromises = orders.map((order, index) =>
          supabase
            .from('schedules')
            .update({ order_number: index + 1 })
            .eq('id', order.id)
        );
        
        await Promise.all(updatePromises);
        toast.success('順序を更新しました');
        // 順序更新後、親コンポーネントに通知
        if (onSaved) {
          await onSaved();
        }
        onClose();
      } catch (error) {
        console.error('Error saving order:', error);
        toast.error('順序の更新に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">作業順序調整</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {isLoading ? (
            <div className="text-center py-4">読み込み中...</div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {orders.map((order, index) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{order.displayOrder}. {order.title}</div>
                      <div className="text-sm text-gray-500">{order.details}</div>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => moveOrder(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveOrder(index, 'down')}
                        disabled={index === orders.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={saveOrder}
                  disabled={isLoading}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Handle cell click to create new sample reservation with pre-filled date and equipment
  const handleCellClick = (equipment: { id: string; name: string; type: string }, date: Date) => {
    console.log('🔍 サンプル予約の新規作成 - セルクリック:', { equipment, date });
    setSelectedEquipment({ id: equipment.id, name: equipment.name, type: equipment.type });
    setSelectedDate(date);
    setEditingSchedule(null); // 新規作成なので編集スケジュールをクリア
    setIsModalOpen(true);
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
      <div className="overflow-auto relative" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <table className="divide-y divide-gray-200" style={{ minWidth: '100%' }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20" style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }}>
                設備
              </th>
              {dates.map((date, i) => (
                <th key={i} scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ 
                  width: view === 'week' ? `calc((100% - 280px) / 7)` : '180px', 
                  minWidth: view === 'week' ? '120px' : '180px' 
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
            {sampleEquipment.map((equipment) => (
              <tr key={equipment.id}>
                <td className="px-3 py-4 sticky left-0 bg-white z-10" style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }}>
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center mt-1">
                      <Box className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-3" style={{ width: 'calc(100% - 52px)' }}>
                      <div className="text-sm font-medium text-gray-900" style={{ wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.4' }}>{equipment.name}</div>
                      <div className="text-xs text-gray-500" style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>{equipment.type}</div>
                    </div>
                  </div>
                </td>
                {dates.map((date, i) => {
                  const schedules = getSampleSchedulesForDay(equipment.id, date);
                  
                  // 作成・編集設備の場合は履歴を表示（現在のサンプル予約一覧を表示）
                  if (equipment.name === 'サンプル作成' || equipment.name === '作成・編集') {
                    // この日のすべてのサンプル予約を取得して履歴として表示
                    const allDaySchedules = sampleSchedules.filter(schedule => {
                      try {
                        const scheduleDate = new Date(schedule.start_time);
                        if (isNaN(scheduleDate.getTime())) {
                          return false;
                        }
                        return isSameDay(scheduleDate, date);
                      } catch {
                        return false;
                      }
                    });
                    
                    return (
                      <td 
                        key={i} 
                        className="px-2 py-2 text-sm text-gray-500 relative group border border-gray-100 align-top cursor-pointer hover:bg-gray-50 transition-colors duration-200" 
                        style={{ 
                          width: view === 'week' ? `calc((100% - 280px) / 7)` : '180px',
                          minWidth: view === 'week' ? '120px' : '180px'
                        }}
                        onClick={() => handleCellClick(equipment, date)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCellClick(equipment, date);
                          }}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-purple-100 rounded-full p-1"
                        >
                          <Plus className="h-4 w-4 text-purple-600" />
                        </button>
                        {/* サンプル予約履歴表示 */}
                        <div className="space-y-1 mt-6">
                          <div className="text-xs font-semibold text-gray-700 mb-1">作成履歴:</div>
                          {allDaySchedules.length > 0 ? (
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {allDaySchedules.map((schedule, idx) => (
                                <div key={schedule.id} className="text-xs p-1 bg-gray-50 rounded border border-gray-200">
                                  <div className="font-medium text-gray-700">
                                    {idx + 1}. {schedule.title}
                                  </div>
                                  {schedule.quantity && (
                                    <div className="text-gray-600">数量: {schedule.quantity}枚</div>
                                  )}
                                  {schedule.assigned_to && (
                                    <div className="text-gray-500">
                                      担当: {users.find(u => u.id === schedule.assigned_to)?.name || '不明'}
                                    </div>
                                  )}
                                  {schedule.created_at && (
                                    <div className="text-gray-400">
                                      {(() => {
                                        try {
                                          const date = new Date(schedule.created_at);
                                          if (isNaN(date.getTime())) {
                                            return '';
                                          }
                                          return format(date, 'HH:mm');
                                        } catch {
                                          return '';
                                        }
                                      })()}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">履歴なし</div>
                          )}
                        </div>
                      </td>
                    );
                  }
                  
                  return (
                    <td 
                      key={i} 
                      className="px-2 py-2 text-sm text-gray-500 relative group border border-gray-100 align-top cursor-pointer hover:bg-gray-50 transition-colors duration-200" 
                      style={{ 
                        width: view === 'week' ? `calc((100% - 280px) / 7)` : '180px',
                        minWidth: view === 'week' ? '120px' : '180px'
                      }}
                      onClick={() => handleCellClick(equipment, date)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellClick(equipment, date);
                        }}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-purple-100 rounded-full p-1"
                      >
                        <Plus className="h-4 w-4 text-purple-600" />
                      </button>
                      {schedules.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedDateForOrder(date);
                            setSelectedEquipmentForOrder(equipment.id);
                            setIsOrderModalOpen(true);
                          }}
                          className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-yellow-100 rounded-full p-1"
                          title="作業順序調整"
                        >
                          <ArrowDownUp className="h-4 w-4 text-yellow-600" />
                        </button>
                      )}
                      <div className={view === 'day' ? 'min-h-[120px]' : 'min-h-[80px] space-y-1'}>
                        {schedules.map((schedule, index) => {
                          // Googleカレンダーからの入力の場合はピンク色、それ以外はパープル色
                          const isFromGoogleCalendar = schedule.isFromGoogleCalendar || schedule.is_from_google_calendar;
                          const colorClasses = isFromGoogleCalendar 
                            ? "bg-pink-200 text-pink-900 border-pink-400 hover:bg-pink-300"
                            : "bg-purple-100 text-purple-800 border-purple-500 hover:bg-purple-200";
                          
                          return (
                            <div 
                              key={schedule.id} 
                              className={`mb-1 px-1 py-1 rounded text-xs border-l-2 cursor-pointer break-words ${colorClasses}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingSchedule(schedule);
                                setIsViewModalOpen(true);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                console.log('Sample reservation context menu triggered:', schedule.title);
                                setContextMenu({ x: e.clientX, y: e.clientY, schedule });
                              }}
                            >
                            <div className="font-medium flex items-center justify-between">
                              <span className="text-sm font-bold flex items-center gap-1">
                                {isFromGoogleCalendar && (
                                  <span className="text-xs" title="Googleカレンダーからの入力">📅</span>
                                )}
                                <span className={isFromGoogleCalendar ? "text-pink-900" : "text-purple-900"}>
                                  順番 {schedule.order_number || index + 1}
                                </span>
                              </span>
                              {schedule.quantity && (
                                <span className={`px-1 rounded text-xs ${isFromGoogleCalendar ? "bg-pink-200 text-pink-800" : "bg-purple-200 text-purple-800"}`}>
                                  {schedule.quantity}枚
                                </span>
                              )}
                            </div>
                            <div className="break-words line-clamp-2">{schedule.title}</div>
                            {schedule.type && schedule.type !== 'default' && (
                              <div className="text-[10px] opacity-70 break-words">
                                種別: {schedule.type}
                              </div>
                            )}
                            <div className="text-[10px] text-purple-700 break-words">
                              担当: {(() => {
                                const assignedUserId = schedule.assigned_to || schedule.assignedTo;
                                const assignedUser = users.find(u => u.id === assignedUserId);
                                if (!assignedUser && assignedUserId) {
                                  console.warn('担当者が見つかりません:', { assignedUserId, schedule, availableUsers: users.map(u => u.id) });
                                }
                                return assignedUser?.name || '未設定';
                              })()}
                            </div>
                            {schedule.details && (
                              <div className="text-[10px] text-purple-600 break-words line-clamp-1">{schedule.details}</div>
                            )}
                          </div>
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
              const daySchedules = sampleEquipment.flatMap(equipment => 
                getSampleSchedulesForDay(equipment.id, date)
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
                      const equipment = sampleEquipment.find(e => 
                        schedule.equipment?.some((eq: any) => eq.id === e.id && eq.type === 'sample')
                      );
                      return (
                        <div 
                          key={schedule.id}
                          onClick={() => {
                            setViewingSchedule(schedule);
                            setIsViewModalOpen(true);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            console.log('Sample month view context menu triggered:', schedule.title);
                            setContextMenu({ x: e.clientX, y: e.clientY, schedule });
                          }}
                          className="text-xs px-1 py-0.5 rounded cursor-pointer hover:opacity-80 bg-purple-100 text-purple-800"
                          title={`${equipment?.name || ''}: ${schedule.title}`}
                        >
                          <div className="flex items-center space-x-1">
                            <Box className="h-3 w-3 flex-shrink-0" />
                            {schedule.isFromGoogleCalendar && (
                              <span className="text-xs" title="Googleカレンダーからの入力">📅</span>
                            )}
                            <span className="truncate">{equipment?.name || ''}</span>
                          </div>
                          {schedule.type && schedule.type !== 'default' && (
                            <div className="text-[10px] opacity-70 truncate">
                              種別: {schedule.type}
                            </div>
                          )}
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
        <h1 className="text-2xl font-semibold text-gray-900">サンプル予約</h1>
        <div className="flex space-x-2">
          {/* デバッグ用テストボタン */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={async () => {
                console.log('📧 === メール送信テスト開始 ===');
                const testSchedule = {
                  id: 'test-123',
                  title: 'テストサンプル予約',
                  type: 'サンプル作成',
                  startTime: new Date(),
                  endTime: new Date(Date.now() + 3600000),
                  participants: [currentUser?.id],
                  details: 'これはテストメールです',
                  equipment: [{ id: 'test', name: 'テスト設備', type: 'sample' }]
                };
                console.log('テストスケジュール:', testSchedule);
                
                try {
                  // Supabase Edge Functionでメール送信
                  const { data, error } = await supabase.functions.invoke('send-schedule-notification-email', {
                    body: {
                      to: [currentUser?.email || 'test@example.com'],
                      type: 'created',
                      schedule: {
                        id: testSchedule.id,
                        title: testSchedule.title,
                        description: testSchedule.details,
                        startTime: testSchedule.startTime,
                        endTime: testSchedule.endTime,
                        type: testSchedule.type,
                        location: 'サンプル作成室',
                        participants: [{
                          id: currentUser?.id || '',
                          name: currentUser?.name || 'テストユーザー',
                          email: currentUser?.email || 'test@example.com'
                        }]
                      },
                      appUrl: window.location.origin
                    }
                  });
                  
                  if (error) throw error;
                  
                  console.log('📧 メール送信結果:', data);
                  toast.success('テストメール送信完了');
                } catch (error) {
                  console.error('📧 メール送信エラー:', error);
                  toast.error('メール送信エラー: ' + error);
                }
              }}
              className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-red-50 hover:bg-red-100"
            >
              📧 メールテスト
            </button>
          )}
          <button
            onClick={() => {
              setSelectedEquipment(null);
              setSelectedDate(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <Plus className="h-5 w-5 mr-1" />
            予約作成
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg mx-[-1rem] px-8">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex items-center justify-between flex-wrap sm:flex-nowrap">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {format(
                  view === 'week' ? weekStartDate : currentDate,
                  'yyyy年M月', 
                  { locale: ja }
                )}
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
                  onClick={() => {
                    setView('week');
                    // 週表示に切り替える時、currentDateを含む週の月曜日をweekStartDateに設定
                    const date = new Date(currentDate);
                    const dayOfWeek = date.getDay();
                    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                    const monday = new Date(date.setDate(diff));
                    monday.setHours(0, 0, 0, 0);
                    setWeekStartDate(monday);
                  }}
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

      {/* コンテキストメニュー */}
      {contextMenu && (
        <div
          className="fixed bg-white shadow-lg rounded-md py-1 border border-gray-200"
          style={{ 
            left: contextMenu.x, 
            top: contextMenu.y,
            zIndex: 9999
          }}
          onMouseLeave={() => {
            console.log('Sample reservation context menu mouse leave');
            setContextMenu(null);
          }}
        >
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              // コピー情報を保持して編集モーダルを開く
              const schedule = contextMenu.schedule;
              setCopiedSchedule(schedule);
              
              // コピー元の情報を保持した新規作成として編集モーダルを開く
              // 全ての項目をコピー元から取得して設定
              setEditingSchedule({
                ...schedule,
                id: '', // 新規作成として扱う
                isCopy: true,
                originalId: schedule.id,
                // 日時は現在日時をデフォルトとして設定（ユーザーが変更可能）
                startTime: new Date(),
                endTime: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
                // その他の項目はコピー元からそのまま使用
                type: schedule.type || 'サンプル作成',
                title: schedule.title || '',
                details: schedule.details || '',
                description: schedule.description || '',
                location: schedule.location || '',
                participants: schedule.participants || [],
                equipment: schedule.equipment || [],
                meetingType: schedule.meetingType || 'in-person',
                meetLink: '', // 新規作成時は空
                notes: schedule.notes || '',
                quantity: schedule.quantity,
                assigned_to: schedule.assigned_to || schedule.assignedTo,
                production_number: schedule.production_number,
                product_code: schedule.product_code,
                sample_number: schedule.sample_number,
                reminders: schedule.reminders || [],
                isAllDay: schedule.isAllDay || false,
                isMultiDay: schedule.isMultiDay || false
              });
              setIsModalOpen(true);
              setContextMenu(null);
            }}
          >
            <span className="mr-2">📋</span>
            コピー
          </button>
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
              const confirmed = await confirm({
                title: '予約の削除',
                message: 'この予約を削除しますか？',
                confirmText: '削除',
                cancelText: 'キャンセル',
                type: 'danger'
              });
              
              if (confirmed) {
                try {
                  const { error } = await supabase
                    .from('schedules')
                    .delete()
                    .eq('id', contextMenu.schedule.id);
                  
                  if (error) throw error;
                  
                  await fetchSampleSchedules();
                } catch (error) {
                  console.error('Error deleting schedule:', error);
                  toast.error('予約の削除に失敗しました');
                }
              }
              setContextMenu(null);
            }}
          >
            <span className="mr-2">🗑️</span>
            削除
          </button>
        </div>
      )}

      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSchedule(null);
          setSelectedDate(null);
          setSelectedEquipment(null);
          setCopiedSchedule(null);
        }}
        onSubmit={handleReservationSubmit}
        selectedDate={selectedDate || undefined}
        selectedEquipment={selectedEquipment || undefined}
        type="sample"
        editingSchedule={editingSchedule}
      />

      <SortOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSaved={async () => {
          // 順序更新後、データを再取得して表示を更新
          await fetchSampleSchedules();
        }}
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
            const originalSchedule = sampleSchedules.find(s => s.id === viewingSchedule.originalId);
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
        onCopy={() => {
          if (viewingSchedule) {
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
              type: viewingSchedule.type || 'サンプル作成',
              title: viewingSchedule.title || '',
              details: viewingSchedule.details || '',
              description: viewingSchedule.description || '',
              location: viewingSchedule.location || '',
              participants: viewingSchedule.participants || [],
              equipment: viewingSchedule.equipment || [],
              meetingType: viewingSchedule.meetingType || 'in-person',
              meetLink: '', // 新規作成時は空
              notes: viewingSchedule.notes || '',
              quantity: viewingSchedule.quantity,
              assigned_to: viewingSchedule.assigned_to || viewingSchedule.assignedTo,
              production_number: viewingSchedule.production_number,
              product_code: viewingSchedule.product_code,
              sample_number: viewingSchedule.sample_number,
              reminders: viewingSchedule.reminders || [],
              isAllDay: viewingSchedule.isAllDay || false,
              isMultiDay: viewingSchedule.isMultiDay || false
            });
            setIsModalOpen(true);
            setIsViewModalOpen(false);
            setViewingSchedule(null);
          }
        }}
        onDelete={async () => {
          if (viewingSchedule) {
            // 削除確認メッセージを表示
            const confirmed = await confirm({
              title: '予約の削除',
              message: 'この予約を削除しますか？',
              confirmText: '削除',
              cancelText: 'キャンセル',
              type: 'danger'
            });
            
            if (confirmed) {
              try {
                const { error } = await supabase
                  .from('schedules')
                  .delete()
                  .eq('id', viewingSchedule.id);
                
                if (error) throw error;
                
                // 削除成功後、データを再取得
                await fetchSampleSchedules();
                setIsViewModalOpen(false);
                setViewingSchedule(null);
              } catch (error) {
                console.error('Error deleting schedule:', error);
                toast.error('予約の削除に失敗しました');
              }
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
            fetchSampleSchedules();
          }}
          schedule={newlyCreatedSchedule}
          users={users}
          onEmailSent={() => {
            console.log('メール送信完了');
          }}
        />
      )}

      {/* 確認モーダル */}
        <ConfirmationModal
          isOpen={confirmationState.isOpen}
          onClose={handleCancel}
          onConfirm={handleConfirm}
          title={confirmationState.title}
          message={confirmationState.message}
          confirmText={confirmationState.confirmText}
          cancelText={confirmationState.cancelText}
          type={confirmationState.type}
        />

    </div>
  );
}