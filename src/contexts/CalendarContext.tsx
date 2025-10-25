import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { addDays, subDays, startOfWeek, endOfWeek, isSameDay, isWithinInterval, format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Schedule, User } from '../types';
import { mockSchedules } from '../data/mockData';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { scheduleNotificationService } from '../services/scheduleNotificationService';
import { operationLogService } from '../services/operationLogService';

interface CalendarContextType {
  currentDate: Date;
  view: 'day' | 'week' | 'month';
  schedules: Schedule[];
  visibleUsers: string[];
  goToTodayTriggered: boolean;
  setCurrentDate: (date: Date) => void;
  setView: (view: 'day' | 'week' | 'month') => void;
  goToNextPeriod: () => void;
  goToPreviousPeriod: () => void;
  goToToday: () => void;
  setGoToTodayTriggered: (triggered: boolean) => void;
  toggleUserVisibility: (userId: string) => void;
  addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>) => Promise<boolean>;
  updateSchedule: (schedule: Schedule) => void;
  deleteSchedule: (scheduleId: string, deletedBy?: string, reason?: string, deleteAllRecurring?: boolean) => Promise<void>;
  getSchedulesForDate: (date: Date) => Schedule[];
  getSchedulesForDateRange: (startDate: Date, endDate: Date) => Schedule[];
  getSchedulesForUser: (userId: string) => Schedule[];
  getSchedulesForEquipment: (equipmentId: string, type: 'room' | 'vehicle' | 'sample') => Schedule[];
  checkScheduleConflicts: (startTime: Date, endTime: Date, participants: string[], equipment: { id: string, type: string }[]) => { hasConflicts: boolean, conflicts: Schedule[] };
  refreshSchedules: () => Promise<void>;
  testReminder: (scheduleId: string, reminderMinutes?: number) => Promise<boolean>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

interface CalendarProviderProps {
  children: ReactNode;
  currentUser?: User | null;
}

export function CalendarProvider({ children, currentUser: providedUser }: CalendarProviderProps) {
  
  const [currentUser, setCurrentUser] = useState<User | null>(providedUser || null);
  
  // providedUserが変更されたらcurrentUserを更新
  useEffect(() => {
    console.log('📅 CalendarProvider: providedUser changed:', providedUser);
    setCurrentUser(providedUser || null);
  }, [providedUser]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  
  // setView関数をラップ（必要に応じてログを追加可能）
  const setViewWithLog = (newView: 'day' | 'week' | 'month') => {
    setView(newView);
  };
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [visibleUsers, setVisibleUsers] = useState<string[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [goToTodayTriggered, setGoToTodayTriggered] = useState(false);

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
  }, [view]);

  // Supabaseからスケジュールを読み込む
  const fetchSchedules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .order('start_time');

      if (error) {
        console.error('Failed to fetch schedules from Supabase:', error);
        // エラーの場合はモックデータを使用
        console.warn('Using mock data for schedules');
        setSchedules(mockSchedules);
      } else if (data) {
        console.log('📋 Supabaseから取得したスケジュール:', {
          totalCount: data.length,
          schedules: data.map(s => ({
            id: s.id,
            title: s.title,
            start_time: s.start_time,
            end_time: s.end_time,
            participants: s.participants,
            created_by: s.created_by
          }))
        });
        
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
        
        console.log('🔍 フィルタリング後のスケジュール:', {
          filteredCount: filteredData.length,
          schedules: filteredData.map(s => ({
            id: s.id,
            title: s.title,
            start_time: s.start_time,
            end_time: s.end_time,
            participants: s.participants,
            created_by: s.created_by
          }))
        });
        
        const convertedSchedules: Schedule[] = filteredData.map(schedule => ({
          id: schedule.id,
          type: schedule.type,
          title: schedule.title,
          details: schedule.details || '',
          startTime: new Date(schedule.start_time),
          endTime: new Date(schedule.end_time),
          isAllDay: schedule.is_all_day,
          isMultiDay: schedule.is_multi_day || (new Date(schedule.end_time).toDateString() !== new Date(schedule.start_time).toDateString()),
          recurrence: schedule.recurrence,
          original_id: schedule.original_id, // 繰り返し予約のインスタンス識別用
          participants: schedule.participants || [],
          equipment: schedule.equipment || [],
          reminders: schedule.reminders || [],
          meetLink: schedule.meet_link,
          meetingType: schedule.meeting_type || 'in-person',
          createdBy: schedule.created_by,
          createdAt: new Date(schedule.created_at),
          updatedBy: schedule.updated_by,
          updatedAt: schedule.updated_at ? new Date(schedule.updated_at) : null,
          isFromGoogleCalendar: schedule.is_from_google_calendar || false,
          isPrivate: schedule.is_private || false
        }));
        
        // デバッグログ：繰り返し予定を確認
        const recurringSchedules = convertedSchedules.filter(s => s.recurrence && s.recurrence.frequency !== 'none');
        
        console.log('✅ 最終的なスケジュール:', {
          finalCount: convertedSchedules.length,
          schedules: convertedSchedules.map(s => ({
            id: s.id,
            title: s.title,
            startTime: s.startTime.toDateString(),
            endTime: s.endTime.toDateString(),
            participants: s.participants,
            participantsType: typeof s.participants,
            participantsLength: s.participants?.length,
            createdBy: s.createdBy,
            createdByType: typeof s.createdBy
          }))
        });
        
        // 開発者の予定を特別にチェック
        const devSchedules = convertedSchedules.filter(s => 
          s.createdBy === 'e9df2750-5e50-41ec-8f23-1e4c19ac45b7' || 
          s.participants.includes('e9df2750-5e50-41ec-8f23-1e4c19ac45b7')
        );
        console.log('👨‍💻 CalendarContext - 開発者の予定:', devSchedules.map(s => ({
          id: s.id,
          title: s.title,
          startTime: s.startTime.toDateString(),
          endTime: s.endTime.toDateString(),
          participants: s.participants,
          createdBy: s.createdBy
        })));
        
        setSchedules(convertedSchedules);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      console.warn('Using mock data for schedules');
      setSchedules(mockSchedules);
    }
  }, []);

  // ユーザーごとの表示設定を読み込む
  const loadUserSettings = useCallback(async () => {
    if (!currentUser) {
      setVisibleUsers([]);
      setIsLoadingSettings(false);
      return;
    }

    setIsLoadingSettings(true);
    setShouldSave(false); // 読み込み時は保存しない

    try {
      const { data, error } = await supabase
        .from('calendar_display_settings')
        .select('visible_user_ids')
        .eq('user_id', currentUser.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 設定が存在しない場合は全ユーザーを表示（デフォルト）
          console.log('⚠️ CalendarContext - No settings found for user:', currentUser.id, 'showing all users');
          // 全ユーザーを取得して表示
          const { data: allUsers } = await supabase
            .from('users')
            .select('id');
          const allUserIds = allUsers?.map(u => u.id) || [];
          console.log('📋 CalendarContext - All user IDs:', allUserIds);
          setVisibleUsers(allUserIds);
        } else {
          console.error('Failed to load user settings:', error);
          setVisibleUsers([]);
        }
      } else if (data) {
        setVisibleUsers(data.visible_user_ids || []);
      }
    } catch (err) {
      console.error('Error loading user settings:', err);
      setVisibleUsers([]);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [currentUser]);

  // ユーザーごとの表示設定を保存する
  const saveUserSettings = useCallback(async (userIds: string[], targetUserId?: string) => {
    const userId = targetUserId || currentUser?.id;
    if (!userId) return;

    try {
      console.log('Saving user settings for user:', userId, 'userIds:', userIds);
      
      const { error } = await supabase
        .from('calendar_display_settings')
        .upsert({
          user_id: userId,
          visible_user_ids: userIds,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Failed to save user settings:', error);
        toast.error('表示設定の保存に失敗しました');
      } else {
        console.log('User settings saved successfully');
      }
    } catch (err) {
      console.error('Error saving user settings:', err);
      toast.error('表示設定の保存中にエラーが発生しました');
    }
  }, [currentUser]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // リマインダーサービスの初期化
  useEffect(() => {
    console.log('⏰ リマインダーサービスを開始します...');
    // scheduleReminderService.start();

    // クリーンアップ関数
    return () => {
      console.log('⏰ リマインダーサービスを停止します...');
      // scheduleReminderService.stop();
    };
  }, []); // 空の依存配列で初回のみ実行

  // ユーザー切り替え時の処理
  const [previousUser, setPreviousUser] = useState<User | null>(null);
  const [previousVisibleUsers, setPreviousVisibleUsers] = useState<string[]>([]);
  
  useEffect(() => {
    // 前のユーザーの設定を保存してから新しいユーザーの設定を読み込む
    const handleUserChange = async () => {
      
      if (previousUser && previousUser.id !== currentUser?.id) {
        // 前のユーザーの設定を保存（前のユーザーのIDを明示的に指定）
        if (previousVisibleUsers.length > 0 || previousUser) {
          await saveUserSettings(previousVisibleUsers, previousUser.id);
        }
      }
      
      // 新しいユーザーの設定を読み込む
      await loadUserSettings();
      
      // 現在のユーザーを記録
      setPreviousUser(currentUser);
    };
    
    handleUserChange();
  }, [currentUser]);

  // visibleUsersが変更されたら前のユーザーの設定として記録
  useEffect(() => {
    if (!isLoadingSettings) {
      setPreviousVisibleUsers(visibleUsers);
    }
  }, [visibleUsers, isLoadingSettings]);

  // 手動で設定を変更したときのみ保存するためのフラグ
  const [shouldSave, setShouldSave] = useState(false);
  
  // visibleUsersが変更されたら保存（ただし、読み込み中やユーザー切り替え時は保存しない）
  useEffect(() => {
    if (!isLoadingSettings && currentUser && shouldSave) {
      saveUserSettings(visibleUsers);
      setShouldSave(false);
    }
  }, [visibleUsers, saveUserSettings, isLoadingSettings, currentUser, shouldSave]);

  const goToNextPeriod = useCallback(() => {
    setCurrentDate(currentDate => {
      switch (view) {
        case 'day':
          return addDays(currentDate, 1);
        case 'week':
          return addDays(currentDate, 7);
        case 'month':
          const nextMonth = new Date(currentDate);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          return nextMonth;
        default:
          return currentDate;
      }
    });
  }, [view]);

  const goToPreviousPeriod = useCallback(() => {
    setCurrentDate(currentDate => {
      switch (view) {
        case 'day':
          return subDays(currentDate, 1);
        case 'week':
          return subDays(currentDate, 7);
        case 'month':
          const prevMonth = new Date(currentDate);
          prevMonth.setMonth(prevMonth.getMonth() - 1);
          return prevMonth;
        default:
          return currentDate;
      }
    });
  }, [view]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    
    // 週表示の場合は、今日の日付が週の最初（左端）に来るように調整
    if (view === 'week') {
      const weekStart = new Date(today);
      weekStart.setHours(0, 0, 0, 0);
      // 週表示の開始日を設定する必要があるが、CalendarContextでは週表示の開始日を管理していない
      // 各カレンダーコンポーネントで個別に管理する必要がある
      // goToTodayが呼ばれたことを示すフラグを設定
      setGoToTodayTriggered(true);
    }
  }, [view]);

  const toggleUserVisibility = useCallback((userIds: string[] | string) => {
    if (Array.isArray(userIds)) {
      // 配列が渡された場合は直接設定
      setVisibleUsers(userIds);
      setShouldSave(true); // 手動変更なので保存フラグを立てる
    } else {
      // 単一のuserIdが渡された場合はトグル
      setVisibleUsers(current => {
        if (current.includes(userIds)) {
          return current.filter(id => id !== userIds);
        } else {
          return [...current, userIds];
        }
      });
      setShouldSave(true); // 手動変更なので保存フラグを立てる
    }
  }, []);

  const getSchedulesForDate = useCallback((date: Date): Schedule[] => {
    return schedules.filter(schedule => {
      // 非公開スケジュールは作成者のみに表示
      if (schedule.isPrivate && schedule.createdBy !== currentUser?.id) {
        return false;
      }
      
      if (isSameDay(new Date(schedule.startTime), date) || isSameDay(new Date(schedule.endTime), date)) {
        return true;
      }
      
      if (new Date(schedule.startTime) < date && new Date(schedule.endTime) > date) {
        return true;
      }
      
      return false;
    });
  }, [schedules, currentUser]);

  const getSchedulesForDateRange = useCallback((startDate: Date, endDate: Date): Schedule[] => {
    const filteredSchedules: Schedule[] = [];
    const processedRecurringSchedules = new Set<string>(); // 重複処理を防ぐためのセット
    
    schedules.forEach(schedule => {
      // 非公開スケジュールは作成者のみに表示
      if (schedule.isPrivate && schedule.createdBy !== currentUser?.id) {
        return; // 非公開スケジュールで作成者でない場合はスキップ
      }
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);
      
      // 繰り返し予約のインスタンス（original_idが設定されている）は表示対象に含める
      // データベースに保存されたインスタンスのみを表示し、動的生成は行わない
      
      // 通常のスケジュール（繰り返しなし）または繰り返し予約のインスタンス
      // ただし、元のスケジュール（original_id: null）で既存のインスタンスがある場合は除外
      if (!schedule.recurrence || schedule.recurrence.frequency === 'none' || schedule.original_id) {
        // 元のスケジュール（original_id: null）で既存のインスタンスがある場合は除外
        if (schedule.original_id === null && schedules.some(s => s.original_id === schedule.id)) {
          return; // 既存のインスタンスがある場合は元のスケジュールを表示しない
        }
        
        // 繰り返し予約のインスタンスの場合は、元のスケジュールのrecurrence情報を取得
        let scheduleToCheck = schedule;
        if (schedule.original_id) {
          const originalSchedule = schedules.find(s => s.id === schedule.original_id);
          if (originalSchedule) {
            scheduleToCheck = { ...schedule, recurrence: originalSchedule.recurrence };
          }
        }
        
        if (
          isWithinInterval(scheduleStart, { start: startDate, end: endDate }) ||
          isWithinInterval(scheduleEnd, { start: startDate, end: endDate }) ||
          (scheduleStart <= startDate && scheduleEnd >= endDate)
        ) {
          filteredSchedules.push(scheduleToCheck);
        }
      } else {
        // 繰り返しスケジュールの処理（重複を防ぐ）
        if (processedRecurringSchedules.has(schedule.id)) {
          return; // 既に処理済みの場合はスキップ
        }
        processedRecurringSchedules.add(schedule.id);
        
        // データベースに既にインスタンスが存在する場合は動的生成をスキップ
        // ただし、元のスケジュール（初日）は表示する
        const hasExistingInstances = schedules.some(s => s.original_id === schedule.id);
        if (hasExistingInstances) {
          // 元のスケジュール（初日）のみを表示
          if (
            isWithinInterval(scheduleStart, { start: startDate, end: endDate }) ||
            isWithinInterval(scheduleEnd, { start: startDate, end: endDate }) ||
            (scheduleStart <= startDate && scheduleEnd >= endDate)
          ) {
            filteredSchedules.push(schedule);
          }
          return; // 動的生成はスキップ
        }
        
        let recurrenceEnd = endDate;
        if (schedule.recurrence.endType === 'date' && schedule.recurrence.endDate) {
          recurrenceEnd = new Date(schedule.recurrence.endDate);
        }
        
        let currentOccurrence = new Date(scheduleStart);
        let occurrenceCount = 0;
        
        // カスタム繰り返しの場合、最初の日が指定された曜日に含まれていない場合は次の指定曜日に進める
        if (schedule.recurrence.frequency === 'custom' && schedule.recurrence.weekdays && schedule.recurrence.weekdays.length > 0) {
          console.log(`🔍 初期処理: ${schedule.title}, 開始日: ${currentOccurrence.getDay()}, 指定曜日: ${schedule.recurrence.weekdays}`);
          while (!schedule.recurrence.weekdays.includes(currentOccurrence.getDay())) {
            currentOccurrence.setDate(currentOccurrence.getDate() + 1);
            console.log(`🔄 次の日へ: ${currentOccurrence.getDay()}`);
          }
          console.log(`✅ 最初の指定曜日に到達: ${currentOccurrence.getDay()}`);
        }
        
        // 開始日が表示範囲より後の場合は、開始日まで進める
        while (currentOccurrence < startDate && currentOccurrence <= recurrenceEnd) {
          // countによる終了条件のチェック（スキップ中もチェック）
          if (schedule.recurrence.endType === 'count' && schedule.recurrence.count && occurrenceCount >= schedule.recurrence.count) {
            break;
          }
          
          // 次の繰り返し日を計算
          switch (schedule.recurrence.frequency) {
            case 'daily':
              currentOccurrence.setDate(currentOccurrence.getDate() + (schedule.recurrence.interval || 1));
              break;
            case 'weekly':
              currentOccurrence.setDate(currentOccurrence.getDate() + 7 * (schedule.recurrence.interval || 1));
              break;
            case 'monthly':
              currentOccurrence.setMonth(currentOccurrence.getMonth() + (schedule.recurrence.interval || 1));
              break;
            case 'yearly':
              currentOccurrence.setFullYear(currentOccurrence.getFullYear() + (schedule.recurrence.interval || 1));
              break;
            case 'weekdays':
              // 平日のみ
              let weekdayCount = 0;
              do {
                currentOccurrence.setDate(currentOccurrence.getDate() + 1);
                weekdayCount++;
              } while ((currentOccurrence.getDay() === 0 || currentOccurrence.getDay() === 6) && weekdayCount < 7);
              break;
            case 'custom':
              // カスタム曜日の繰り返し
              if (schedule.recurrence.weekdays && schedule.recurrence.weekdays.length > 0) {
                const currentDay = currentOccurrence.getDay();
                const weekdays = schedule.recurrence.weekdays.sort((a, b) => a - b);
                const interval = schedule.recurrence.interval || 1; // デフォルトは1週間

                // 現在の日が指定された曜日に含まれているかチェック
                if (weekdays.includes(currentDay)) {
                  // 現在の日が指定された曜日の場合は、同じ週内の次の指定曜日に進む
                  const currentIndex = weekdays.indexOf(currentDay);
                  if (currentIndex < weekdays.length - 1) {
                    // 同じ週内に次の指定曜日がある場合
                    const nextDay = weekdays[currentIndex + 1];
                    const daysToNext = nextDay - currentDay;
                    currentOccurrence.setDate(currentOccurrence.getDate() + daysToNext);
                  } else {
                    // 同じ週内に次の指定曜日がない場合、次のインターバル週の最初の指定曜日に進む
                    const daysToNextWeek = 7 - currentDay + weekdays[0];
                    const daysToAdd = daysToNextWeek + (interval - 1) * 7;
                    currentOccurrence.setDate(currentOccurrence.getDate() + daysToAdd);
                  }
                } else {
                  // 現在の日が指定された曜日に含まれていない場合、次の指定曜日に進む
                  // まず同じ週内で次の指定曜日があるかチェック
                  let daysToAdd = 1;
                  let nextDay = (currentDay + 1) % 7;
                  let foundInSameWeek = false;
                  
                  // 同じ週内で次の指定曜日を探す（最大6日先まで）
                  for (let i = 1; i <= 6; i++) {
                    nextDay = (currentDay + i) % 7;
                    if (weekdays.includes(nextDay)) {
                      daysToAdd = i;
                      foundInSameWeek = true;
                      break;
                    }
                  }
                  
                  if (foundInSameWeek) {
                    // 同じ週内に次の指定曜日がある場合
                    currentOccurrence.setDate(currentOccurrence.getDate() + daysToAdd);
                  } else {
                    // 同じ週内に次の指定曜日がない場合、次のインターバル週の最初の指定曜日に進む
                    const daysToNextWeek = 7 - currentDay + weekdays[0];
                    const daysToAdd = daysToNextWeek + (interval - 1) * 7;
                    currentOccurrence.setDate(currentOccurrence.getDate() + daysToAdd);
                  }
                }

              } else {
                // weekdaysが指定されていない場合はエラーとして処理を停止
                console.warn('カスタム繰り返しでweekdaysが指定されていません:', schedule.id, schedule.title);
                currentOccurrence = new Date(recurrenceEnd.getTime() + 1);
              }
              break;
            default:
              // 繰り返しなし
              currentOccurrence = new Date(recurrenceEnd.getTime() + 1);
              break;
          }
          
          // スキップ中もoccurrenceCountをカウント（countによる終了条件のため）
          if (schedule.recurrence.endType === 'count') {
            occurrenceCount++;
          }
        }
        
        // 表示範囲内の繰り返しインスタンスを生成
        while (currentOccurrence <= recurrenceEnd && currentOccurrence <= endDate) {
          // countによる終了条件のチェック（最初にチェック）
          if (schedule.recurrence.endType === 'count' && schedule.recurrence.count && occurrenceCount >= schedule.recurrence.count) {
            break;
          }
          
          // neverの場合、表示範囲を超えたら終了（無限ループ防止）
          if (schedule.recurrence.endType === 'never' && currentOccurrence > endDate) {
            break;
          }
          
          // occurrenceCountを先にカウント（表示範囲に関係なく）
          occurrenceCount++;
          
          if (currentOccurrence >= startDate) {
            // カスタム繰り返しの場合、現在の日が指定された曜日に含まれている場合のみ予定を表示
            if (schedule.recurrence.frequency === 'custom' && schedule.recurrence.weekdays && schedule.recurrence.weekdays.length > 0) {
              const currentDay = currentOccurrence.getDay();
              console.log(`🔍 カスタム繰り返しチェック: ${schedule.title}, 現在の日: ${currentDay}, 指定曜日: ${schedule.recurrence.weekdays}, 日付: ${currentOccurrence.toISOString()}`);
              if (!schedule.recurrence.weekdays.includes(currentDay)) {
                console.log(`❌ スキップ: ${currentDay}は指定曜日${schedule.recurrence.weekdays}に含まれていません`);
                // 現在の日が指定された曜日に含まれていない場合は、予定を表示せずに次の日へ進む
                // 次の繰り返し日を計算してcontinue
                switch (schedule.recurrence.frequency) {
                  case 'custom':
                    if (schedule.recurrence.weekdays && schedule.recurrence.weekdays.length > 0) {
                      const weekdays = schedule.recurrence.weekdays.sort((a, b) => a - b);
                      const interval = schedule.recurrence.interval || 1;
                      
                      // 同じ週内で次の指定曜日を探す
                      let daysToAdd = 1;
                      let nextDay = (currentDay + 1) % 7;
                      let foundInSameWeek = false;
                      
                      for (let i = 1; i <= 6; i++) {
                        nextDay = (currentDay + i) % 7;
                        if (schedule.recurrence.weekdays.includes(nextDay)) {
                          daysToAdd = i;
                          foundInSameWeek = true;
                          break;
                        }
                      }
                      
                      if (foundInSameWeek) {
                        currentOccurrence.setDate(currentOccurrence.getDate() + daysToAdd);
                      } else {
                        const daysToNextWeek = 7 - currentDay + weekdays[0];
                        const daysToAdd = daysToNextWeek + (interval - 1) * 7;
                        currentOccurrence.setDate(currentOccurrence.getDate() + daysToAdd);
                      }
                    }
                    break;
                }
                continue; // 予定を表示せずに次の日へ
              }
            }
            
            // 繰り返しのインスタンスを作成
            const occurrenceEnd = new Date(currentOccurrence);
            
            if (schedule.isMultiDay) {
              // 複数日にまたがる予定の場合、日数の差分を維持
              const dayDiff = Math.floor((scheduleEnd.getTime() - scheduleStart.getTime()) / (1000 * 60 * 60 * 24));
              occurrenceEnd.setDate(occurrenceEnd.getDate() + dayDiff);
              occurrenceEnd.setHours(scheduleEnd.getHours(), scheduleEnd.getMinutes());
            } else {
              // 単日の予定の場合
              occurrenceEnd.setHours(scheduleEnd.getHours(), scheduleEnd.getMinutes());
            }
            
            const recurrenceInstance = {
              ...schedule,
              id: `${schedule.id}_${currentOccurrence.toISOString()}`,
              originalId: schedule.id, // 元のスケジュールIDを保持
              startTime: new Date(currentOccurrence),
              endTime: occurrenceEnd
            };
            
            console.log(`✅ 予定を表示: ${schedule.title}, 日付: ${currentOccurrence.toISOString()}, 曜日: ${currentOccurrence.getDay()}`);
            filteredSchedules.push(recurrenceInstance);
          }
          
          // 次の繰り返し日を計算
          switch (schedule.recurrence.frequency) {
            case 'daily':
              currentOccurrence.setDate(currentOccurrence.getDate() + (schedule.recurrence.interval || 1));
              break;
            case 'weekly':
              currentOccurrence.setDate(currentOccurrence.getDate() + 7 * (schedule.recurrence.interval || 1));
              break;
            case 'monthly':
              currentOccurrence.setMonth(currentOccurrence.getMonth() + (schedule.recurrence.interval || 1));
              break;
            case 'yearly':
              currentOccurrence.setFullYear(currentOccurrence.getFullYear() + (schedule.recurrence.interval || 1));
              break;
            case 'weekdays':
              // 平日のみ
              let weekdayCount2 = 0;
              do {
                currentOccurrence.setDate(currentOccurrence.getDate() + 1);
                weekdayCount2++;
              } while ((currentOccurrence.getDay() === 0 || currentOccurrence.getDay() === 6) && weekdayCount2 < 7);
              break;
            case 'custom':
              // カスタム曜日の繰り返し
              if (schedule.recurrence.weekdays && schedule.recurrence.weekdays.length > 0) {
                const currentDay = currentOccurrence.getDay();
                const weekdays = schedule.recurrence.weekdays.sort((a, b) => a - b);
                const interval = schedule.recurrence.interval || 1; // デフォルトは1週間

                // 現在の日が指定された曜日に含まれているかチェック
                if (weekdays.includes(currentDay)) {
                  // 現在の日が指定された曜日の場合は、同じ週内の次の指定曜日に進む
                  const currentIndex = weekdays.indexOf(currentDay);
                  if (currentIndex < weekdays.length - 1) {
                    // 同じ週内に次の指定曜日がある場合
                    const nextDay = weekdays[currentIndex + 1];
                    const daysToNext = nextDay - currentDay;
                    currentOccurrence.setDate(currentOccurrence.getDate() + daysToNext);
                  } else {
                    // 同じ週内に次の指定曜日がない場合、次のインターバル週の最初の指定曜日に進む
                    const daysToNextWeek = 7 - currentDay + weekdays[0];
                    const daysToAdd = daysToNextWeek + (interval - 1) * 7;
                    currentOccurrence.setDate(currentOccurrence.getDate() + daysToAdd);
                  }
                } else {
                  // 現在の日が指定された曜日に含まれていない場合、次の指定曜日に進む
                  let daysToAdd = 1;
                  let nextDay = (currentDay + 1) % 7;
                  
                  // 次の指定曜日を見つけるまでループ
                  while (!weekdays.includes(nextDay)) {
                    daysToAdd++;
                    nextDay = (nextDay + 1) % 7;
                  }
                  
                  currentOccurrence.setDate(currentOccurrence.getDate() + daysToAdd);
                }

              } else {
                // weekdaysが指定されていない場合はエラーとして処理を停止
                console.warn('カスタム繰り返しでweekdaysが指定されていません:', schedule.id, schedule.title);
                currentOccurrence = new Date(recurrenceEnd.getTime() + 1);
              }
              break;
            default:
              // 繰り返しなし
              currentOccurrence = new Date(recurrenceEnd.getTime() + 1);
              break;
          }
        }
      }
    });
    
    return filteredSchedules;
  }, [schedules, currentUser]);

  const checkScheduleConflicts = useCallback((
    startTime: Date,
    endTime: Date,
    participants: string[],
    equipment: { id: string, type: string }[],
    excludeScheduleId?: string
  ) => {
    const conflicts = schedules.filter(schedule => {
      // 編集対象の予定を除外
      if (excludeScheduleId && schedule.id === excludeScheduleId) {
        return false;
      }

      // サンプル予約は重複検出から除外
      if (schedule.type === 'サンプル作成' || 
          schedule.equipment?.some(eq => eq.type === 'sample')) {
        return false;
      }

      const timeOverlap = (
        (startTime >= schedule.startTime && startTime < schedule.endTime) ||
        (endTime > schedule.startTime && endTime <= schedule.endTime) ||
        (startTime <= schedule.startTime && endTime >= schedule.endTime)
      );

      if (!timeOverlap) return false;

      const participantConflict = participants.some(userId =>
        schedule.participants.includes(userId)
      );

      const equipmentConflict = equipment.some(eq =>
        schedule.equipment.some(schedEq =>
          schedEq.id === eq.id && schedEq.type === eq.type
        )
      );

      return participantConflict || equipmentConflict;
    });

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }, [schedules]);

  // 繰り返しインスタンスを生成するメソッド
  const generateRecurrenceInstances = useCallback((scheduleData: any) => {
    console.log('🔄 generateRecurrenceInstances called with:', scheduleData);
    const instances = [];
    const { recurrence, startTime, endTime } = scheduleData;
    
    if (!recurrence || recurrence.frequency === 'none') {
      console.log('🔄 繰り返しなし、単一インスタンスを返す');
      return [{ startTime, endTime, id: null }];
    }

    const duration = endTime.getTime() - startTime.getTime();
    let currentDate = new Date(startTime);
    const endDate = new Date(recurrence.endDate);
    
    console.log('🔄 繰り返し設定:', {
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      endDate: endDate.toISOString(),
      startDate: currentDate.toISOString()
    });
    
    // カスタム繰り返しの場合、最初の日が指定された曜日に含まれていない場合は次の指定曜日に進める
    if (recurrence.frequency === 'custom' && recurrence.weekdays && recurrence.weekdays.length > 0) {
      console.log(`🔍 初期処理: 開始日: ${currentDate.getDay()}, 指定曜日: ${recurrence.weekdays}`);
      while (!recurrence.weekdays.includes(currentDate.getDay())) {
        currentDate.setDate(currentDate.getDate() + 1);
        console.log(`🔄 次の日へ: ${currentDate.getDay()}`);
      }
      console.log(`✅ 最初の指定曜日に到達: ${currentDate.getDay()}`);
    }
    
    // 最大100回まで（無限ループ防止）
    let count = 0;
    const maxCount = 100;
    
    while (currentDate <= endDate && count < maxCount) {
      const instanceEndTime = new Date(currentDate.getTime() + duration);
      
      console.log(`🔄 インスタンス ${count}: ${currentDate.toISOString()} - ${instanceEndTime.toISOString()}`);
      
      instances.push({
        startTime: new Date(currentDate),
        endTime: instanceEndTime,
        id: null
      });
      
      // 次の日付を計算
      switch (recurrence.frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + (recurrence.interval || 1));
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7 * (recurrence.interval || 1));
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + (recurrence.interval || 1));
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + (recurrence.interval || 1));
          break;
        case 'weekdays':
          // 平日のみ（月〜金）
          do {
            currentDate.setDate(currentDate.getDate() + 1);
          } while (currentDate.getDay() === 0 || currentDate.getDay() === 6);
          break;
        case 'custom':
          // カスタム曜日の繰り返し
          if (recurrence.weekdays && recurrence.weekdays.length > 0) {
            const currentDay = currentDate.getDay();
            const weekdays = recurrence.weekdays.sort((a, b) => a - b);
            const interval = recurrence.interval || 1; // デフォルトは1週間

            // 現在の日が指定された曜日に含まれているかチェック
            if (weekdays.includes(currentDay)) {
              // 現在の日が指定された曜日の場合は、同じ週内の次の指定曜日に進む
              const currentIndex = weekdays.indexOf(currentDay);
              if (currentIndex < weekdays.length - 1) {
                // 同じ週内に次の指定曜日がある場合
                const nextDay = weekdays[currentIndex + 1];
                const daysToNext = nextDay - currentDay;
                currentDate.setDate(currentDate.getDate() + daysToNext);
              } else {
                // 同じ週内に次の指定曜日がない場合、次のインターバル週の最初の指定曜日に進む
                const daysToNextWeek = 7 - currentDay + weekdays[0];
                const daysToAdd = daysToNextWeek + (interval - 1) * 7;
                currentDate.setDate(currentDate.getDate() + daysToAdd);
              }
            } else {
              // 現在の日が指定された曜日に含まれていない場合、次の指定曜日に進む
              // まず同じ週内で次の指定曜日があるかチェック
              let daysToAdd = 1;
              let nextDay = (currentDay + 1) % 7;
              let foundInSameWeek = false;
              
              // 同じ週内で次の指定曜日を探す（最大6日先まで）
              for (let i = 1; i <= 6; i++) {
                nextDay = (currentDay + i) % 7;
                if (weekdays.includes(nextDay)) {
                  daysToAdd = i;
                  foundInSameWeek = true;
                  break;
                }
              }
              
              if (foundInSameWeek) {
                // 同じ週内に次の指定曜日がある場合
                currentDate.setDate(currentDate.getDate() + daysToAdd);
              } else {
                // 同じ週内に次の指定曜日がない場合、次のインターバル週の最初の指定曜日に進む
                const daysToNextWeek = 7 - currentDay + weekdays[0];
                const daysToAdd = daysToNextWeek + (interval - 1) * 7;
                currentDate.setDate(currentDate.getDate() + daysToAdd);
              }
            }
          } else {
            // weekdaysが指定されていない場合は毎日として扱う
            console.warn('カスタム繰り返しでweekdaysが指定されていません。毎日として処理します。');
            currentDate.setDate(currentDate.getDate() + 1);
          }
          break;
        default:
          currentDate.setDate(currentDate.getDate() + 1);
      }
      
      count++;
    }
    
    console.log(`🔄 生成完了: ${instances.length}個のインスタンス`);
    return instances;
  }, []);

  const addSchedule = useCallback(async (scheduleData: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>) => {
    console.log('🟢 === CalendarContext.addSchedule called ===');
    console.log('受信データ:', scheduleData);
    console.log('currentUser:', currentUser);
    
    // targetScheduleを関数の先頭で定義
    let targetSchedule: Schedule | null = null;
    
    // 予約上限チェックを一時的に無効化（デバッグのため）
      // const daySchedules = getSchedulesForDate(scheduleData.startTime);
      // if (daySchedules.length >= 10) {
      //   toast.error('1日の予約上限（10件）に達しています');
      //   return false;
      // }

      // 重複チェック（skipConflictCheckフラグがtrueの場合はスキップ）
      if (!(scheduleData as any).skipConflictCheck) {
        const { hasConflicts, conflicts } = checkScheduleConflicts(
          scheduleData.startTime,
          scheduleData.endTime,
          scheduleData.participants,
          scheduleData.equipment,
          (scheduleData as any).excludeScheduleId // 編集時の除外ID
        );

        if (hasConflicts) {
          // 重複確認は呼び出し元で処理するため、ここではエラーを返す
          toast.error('予定が重複しています。確認してください。');
          return false;
        }
      }

      // データ検証
        console.log('Schedule data before saving:', {
          type: scheduleData.type,
          title: scheduleData.title,
          startTime: scheduleData.startTime,
          endTime: scheduleData.endTime,
          participants: scheduleData.participants,
          createdBy: scheduleData.createdBy
        });

        if (!scheduleData.type || !scheduleData.title || !scheduleData.startTime || !scheduleData.endTime) {
          console.error('Required fields missing:', { 
            type: scheduleData.type, 
            title: scheduleData.title, 
            startTime: scheduleData.startTime, 
            endTime: scheduleData.endTime 
          });
          toast.error('必須フィールドが不足しています');
          return false;
        }

        // 繰り返し予約の場合は各インスタンスを個別に作成
        if (scheduleData.recurrence && scheduleData.recurrence.frequency !== 'none') {
          console.log('🔄 繰り返し予約を作成中...', scheduleData.recurrence);
          console.log('🔄 開始日:', scheduleData.startTime);
          console.log('🔄 終了日:', scheduleData.endTime);
          console.log('🔄 繰り返し終了日:', scheduleData.recurrence.endDate);
          
          // 繰り返しインスタンスを生成
          const instances = generateRecurrenceInstances(scheduleData);
          console.log('🔄 生成されたインスタンス数:', instances.length);
          console.log('🔄 インスタンス詳細:', instances.map((inst, i) => `${i}: ${inst.startTime.toISOString()} - ${inst.endTime.toISOString()}`));
        
          // 各インスタンスを個別に保存
          // 最初に元のスケジュール（original_id: null）を作成
          const originalScheduleData = {
            type: scheduleData.type,
            title: scheduleData.title,
            details: scheduleData.details || null,
            start_time: instances[0].startTime.toISOString(),
            end_time: instances[0].endTime.toISOString(),
            is_all_day: scheduleData.isAllDay || false,
            is_multi_day: scheduleData.isMultiDay || false,
            recurrence: scheduleData.recurrence, // 元のスケジュールにrecurrence情報を保存
            participants: scheduleData.participants || [],
            equipment: scheduleData.equipment || [],
            reminders: scheduleData.reminders || [],
            meet_link: scheduleData.meetLink || null,
            meeting_type: scheduleData.meetingType || 'in-person',
            created_by: scheduleData.createdBy || null,
            original_id: null, // 元のスケジュールはnull
            is_private: scheduleData.isPrivate || false
          };

        // 元のスケジュールを先に作成
        const { data: originalData, error: originalError } = await supabase
          .from('schedules')
          .insert([originalScheduleData])
          .select();

        if (originalError) {
          console.error('🚨 元のスケジュール作成エラー:', originalError);
          console.error('🚨 Error code:', originalError.code);
          console.error('🚨 Error message:', originalError.message);
          console.error('🚨 Error details:', originalError.details);
          console.error('🚨 Error hint:', originalError.hint);
          console.error('🚨 Original schedule data that failed:', originalScheduleData);
          toast.error('繰り返し予約の作成に失敗しました');
          return false;
        }

        const originalId = originalData[0].id;
        console.log('🔄 元のスケジュール作成完了:', originalId);

        // 残りのインスタンスを作成（original_idを設定）
        const instanceData = instances.slice(1).map((instance, index) => ({
          type: scheduleData.type,
          title: scheduleData.title,
          details: scheduleData.details || null,
          start_time: instance.startTime.toISOString(),
          end_time: instance.endTime.toISOString(),
          is_all_day: scheduleData.isAllDay || false,
          is_multi_day: scheduleData.isMultiDay || false,
          recurrence: null, // インスタンスにはrecurrence情報なし
          participants: scheduleData.participants || [],
          equipment: scheduleData.equipment || [],
          reminders: scheduleData.reminders || [],
          meet_link: scheduleData.meetLink || null,
          meeting_type: scheduleData.meetingType || 'in-person',
          created_by: scheduleData.createdBy || null,
          original_id: originalId, // 元のスケジュールのIDを設定
          is_private: scheduleData.isPrivate || false
        }));

        // インスタンスを作成（original_idが既に設定済み）
        let instanceDataResult = [];
        if (instanceData.length > 0) {
          const { data: instanceResult, error: instanceError } = await supabase
            .from('schedules')
            .insert(instanceData)
            .select();

          if (instanceError) {
            console.error('🚨 インスタンス作成エラー:', instanceError);
            console.error('🚨 Error code:', instanceError.code);
            console.error('🚨 Error message:', instanceError.message);
            console.error('🚨 Error details:', instanceError.details);
            console.error('🚨 Error hint:', instanceError.hint);
            console.error('🚨 Instance data that failed:', instanceData);
            toast.error('繰り返し予約のインスタンス作成に失敗しました');
            return false;
          }
          instanceDataResult = instanceResult;
        }

        // 全てのデータを結合（元のスケジュール + インスタンス）
        const finalData = [...originalData, ...instanceDataResult];
        console.log('🔄 繰り返し予約作成完了:', finalData.length, '件');

        console.log('繰り返し予約を作成しました:', finalData);
        toast.success(`${instances.length}件の繰り返し予約を作成しました`);
        
        // 繰り返し予約の各インスタンスをスケジュールリストに追加
        const newSchedules: Schedule[] = finalData.map((item: any, index: number) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          details: item.details || '',
          startTime: new Date(item.start_time),
          endTime: new Date(item.end_time),
          isAllDay: item.is_all_day,
          isMultiDay: item.is_multi_day || (new Date(item.end_time).toDateString() !== new Date(item.start_time).toDateString()),
          recurrence: item.recurrence,
          participants: item.participants || [],
          equipment: item.equipment || [],
          reminders: item.reminders || [],
          meetLink: item.meet_link,
          meetingType: item.meeting_type || 'in-person',
          createdBy: item.created_by,
          createdAt: new Date(item.created_at),
          updatedBy: item.updated_by,
          updatedAt: item.updated_at ? new Date(item.updated_at) : null,
          original_id: item.original_id // データベースから取得した値をそのまま使用
        }));
        
        setSchedules(current => [...current, ...newSchedules]);
        
        // 繰り返し予約の場合は最初のインスタンスをtargetScheduleに設定
        targetSchedule = newSchedules[0];
        
      } else {
        // 通常の予約（繰り返しなし）
      const { data, error } = await supabase
        .from('schedules')
        .insert([{
          type: scheduleData.type,
          title: scheduleData.title,
          details: scheduleData.details || null,
          start_time: scheduleData.startTime.toISOString(),
          end_time: scheduleData.endTime.toISOString(),
          is_all_day: scheduleData.isAllDay || false,
          is_multi_day: scheduleData.isMultiDay || false,
            recurrence: null,
          participants: scheduleData.participants || [],
          equipment: scheduleData.equipment || [],
          reminders: scheduleData.reminders || [],
          meet_link: scheduleData.meetLink || null,
          meeting_type: scheduleData.meetingType || 'in-person',
          created_by: scheduleData.createdBy || null,
            original_id: null,
            is_private: scheduleData.isPrivate || false
        }])
        .select()
        .single();

      if (error) {
        console.error('🚨 Supabase error details:', error);
        console.error('🚨 Error code:', error.code);
        console.error('🚨 Error message:', error.message);
        console.error('🚨 Error details:', error.details);
        console.error('🚨 Error hint:', error.hint);
        console.error('🚨 Schedule data that failed:', {
          type: scheduleData.type,
          title: scheduleData.title,
          startTime: scheduleData.startTime,
          endTime: scheduleData.endTime,
          participants: scheduleData.participants,
          createdBy: scheduleData.createdBy
        });
        toast.error(`予約の保存に失敗しました: ${error.message}`);
        return false;
      }

      const newSchedule: Schedule = {
        id: data.id,
        type: data.type,
        title: data.title,
        details: data.details || '',
        startTime: new Date(data.start_time),
        endTime: new Date(data.end_time),
        isAllDay: data.is_all_day,
        isMultiDay: data.is_multi_day || (new Date(data.end_time).toDateString() !== new Date(data.start_time).toDateString()),
        recurrence: data.recurrence,
          original_id: data.original_id, // 繰り返し予約のインスタンス識別用
        participants: data.participants || [],
        equipment: data.equipment || [],
        reminders: data.reminders || [],
        meetLink: data.meet_link,
        meetingType: data.meeting_type || 'in-person',
        createdBy: data.created_by,
        createdAt: new Date(data.created_at),
        updatedBy: data.updated_by,
          updatedAt: data.updated_at ? new Date(data.updated_at) : null,
          isPrivate: data.is_private || false
      };

      setSchedules(current => [...current, newSchedule]);
      
      // 通常予約の場合はnewScheduleをtargetScheduleに設定
      targetSchedule = newSchedule;

      // 履歴記録（一時的に無効化）
      /*
      if (currentUser) {
        // const description = ScheduleHistoryService.generateDescription('create', targetSchedule.title, currentUser);
        // await ScheduleHistoryService.recordOperation(
          targetSchedule.id,
          'create',
          currentUser,
          description,
          targetSchedule
        );
      }
      */
      console.log('履歴記録は一時的に無効化されています (create)');

      // 通常予約の場合はtoastを表示
      toast.success('予約を作成しました');
        
      if (targetSchedule) {
      const { error: historyError } = await supabase
        .from('schedule_history')
        .insert({
            schedule_id: targetSchedule.id,
          operation_type: 'create',
          operator_id: scheduleData.createdBy || currentUser?.id || '',
          operator_name: currentUser?.name || '不明',
          description: `スケジュールを作成しました`,
            schedule_data: targetSchedule
        });

      if (historyError) {
        console.error('Error saving schedule history:', historyError);
      }

        // 既に下で自動同期を実行するため、ここは削除
      }

      // Send notifications to all participants（繰り返し予約の場合は最初のインスタンスのみ）
      if (targetSchedule) {
      try {
        console.log('=== 通知送信開始 ===');
          console.log('参加者:', targetSchedule.participants);
        
          const participantPromises = targetSchedule.participants.map(async (participantId) => {
          console.log(`参加者 ${participantId} への通知処理開始`);
          
          // Get participant details
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', participantId)
            .single();

          if (userError) {
            console.error(`ユーザーデータ取得エラー (${participantId}):`, userError);
            return;
          }

          if (userData) {
            console.log(`ユーザーデータ取得成功:`, userData);
            try {
              /* await notificationService.notifyScheduleCreated({
                schedule: {
                  id: targetSchedule.id,
                  title: targetSchedule.title,
                  type: targetSchedule.type,
                  startTime: targetSchedule.startTime,
                  endTime: targetSchedule.endTime,
                  details: targetSchedule.details,
                  meetLink: targetSchedule.meetLink,
                  participants: targetSchedule.participants,
                  location: getLocationFromEquipment(targetSchedule.equipment)
                },
                user: {
                  id: userData.id,
                  name: userData.name,
                  email: userData.email
                }
              }); */
              console.log(`通知送信完了: ${userData.name}`);
            } catch (notifError) {
              console.error(`通知送信エラー (${userData.name}):`, notifError);
            }
          }
        });

        await Promise.all(participantPromises);
        console.log('=== プッシュ通知送信完了 ===');
        
        // メール通知の送信（全参加者に一括送信）
        // sendEmailOnSaveフラグが有効な場合のみ送信
        console.log('📧 メール送信チェック:');
        console.log('  - participants.length:', targetSchedule.participants.length);
        console.log('  - sendEmailOnSave:', scheduleData.sendEmailOnSave);
        console.log('  - sendEmailOnSaveの型:', typeof scheduleData.sendEmailOnSave);
        console.log('  - sendEmailOnSave === undefined?:', scheduleData.sendEmailOnSave === undefined);
        console.log('  - sendEmailOnSave === true?:', scheduleData.sendEmailOnSave === true);
        console.log('  - sendEmailOnSave === false?:', scheduleData.sendEmailOnSave === false);
        console.log('  - 条件を満たす?:', targetSchedule.participants.length > 0 && scheduleData.sendEmailOnSave !== false);
        
        if (targetSchedule.participants.length > 0 && scheduleData.sendEmailOnSave !== false) {
          console.log('=== メール通知送信開始 ===');
          console.log('sendEmailOnSave:', scheduleData.sendEmailOnSave);
          
          const { data: participantsData, error: participantsError } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', targetSchedule.participants);
          
          if (participantsError) {
            console.error('参加者データ取得エラー:', participantsError);
          } else if (participantsData && participantsData.length > 0) {
            try {
              const emailSent = await scheduleNotificationService.sendScheduleCreatedNotification(
                targetSchedule,
                participantsData,
                currentUser?.name
              );
              
              if (emailSent) {
                console.log('✅ スケジュール作成メール通知送信成功');
                if (targetSchedule.meetLink) {
                  console.log('✨ Google Meet URL付きメールを送信しました');
                }
              } else {
                console.log('❌ スケジュール作成メール通知送信失敗');
              }
            } catch (emailError) {
              console.error('メール通知送信エラー:', emailError);
            }
          }
          
          console.log('=== メール通知送信完了 ===');
        } else if (scheduleData.sendEmailOnSave === false) {
          console.log('📧 メール送信オプションが無効のため、メール通知をスキップしました');
        }
        
        // 操作履歴を記録
        if (currentUser && targetSchedule) {
          await operationLogService.logOperation({
            operation_type: 'CREATE',
            target_type: 'SCHEDULE',
            target_id: targetSchedule.id,
            target_title: targetSchedule.title,
            operator_id: currentUser.id,
            operator_name: currentUser.name,
            operation_details: {
              startTime: targetSchedule.startTime,
              endTime: targetSchedule.endTime,
              participants: targetSchedule.participants,
              type: targetSchedule.type
            }
          });
        }

        // Google Calendar自動同期（単一予定）
        try {
          const { simpleSyncService } = await import('../services/simpleSyncService');
          await simpleSyncService.syncSingleScheduleToGoogle(targetSchedule, currentUser?.id || '');
          console.log('✅ Google Calendar単一予定同期完了 (add):', targetSchedule.title);
        } catch (error) {
          console.error('❌ Google Calendar単一予定同期エラー:', error);
          // エラーでも予定作成は継続
        }

        return true;
      } catch (error) {
        console.error('Notification error:', error);
        return true;
      }
      }
    }
  }, [schedules, getSchedulesForDate, checkScheduleConflicts]);

  const updateSchedule = useCallback(async (updatedSchedule: Schedule) => {
    try {
      // Get the original schedule for comparison
      const originalSchedule = schedules.find(s => s.id === updatedSchedule.id);
      if (!originalSchedule) return;

      // Update in Supabase
      const { error } = await supabase
        .from('schedules')
        .update({
          type: updatedSchedule.type,
          title: updatedSchedule.title,
          details: updatedSchedule.details || null,
          start_time: updatedSchedule.startTime.toISOString(),
          end_time: updatedSchedule.endTime.toISOString(),
          is_all_day: updatedSchedule.isAllDay || false,
          is_multi_day: updatedSchedule.isMultiDay || false,
          recurrence: updatedSchedule.recurrence || null,
          original_id: updatedSchedule.original_id || null, // 繰り返し予約のインスタンス識別用
          participants: updatedSchedule.participants || [],
          equipment: updatedSchedule.equipment || [],
          reminders: updatedSchedule.reminders || [],
          meet_link: updatedSchedule.meetLink || null,
          meeting_type: updatedSchedule.meetingType || 'in-person',
          updated_by: updatedSchedule.updatedBy || null,
          updated_at: new Date().toISOString(),
          is_private: updatedSchedule.isPrivate || false
        })
        .eq('id', updatedSchedule.id);

      if (error) {
        console.error('Error updating schedule:', error);
        toast.error('予約の更新に失敗しました');
        return;
      }

      // 操作履歴を記録
      const { error: historyError } = await supabase
        .from('schedule_history')
        .insert({
          schedule_id: updatedSchedule.id,
          operation_type: 'update',
          operator_id: updatedSchedule.updatedBy || currentUser?.id || '',
          operator_name: currentUser?.name || '不明',
          description: `スケジュールを編集しました`,
          schedule_data: updatedSchedule
        });

      if (historyError) {
        console.error('Error saving schedule history:', historyError);
      }

      setSchedules(current => 
        current.map(schedule => 
          schedule.id === updatedSchedule.id ? {
            ...updatedSchedule,
            updatedAt: new Date()
          } : schedule
        )
      );

      toast.success('予約を更新しました');

      // 操作履歴を記録
      if (currentUser) {
        await operationLogService.logOperation({
          operation_type: 'UPDATE',
          target_type: 'SCHEDULE',
          target_id: updatedSchedule.id,
          target_title: updatedSchedule.title,
          operator_id: currentUser.id,
          operator_name: currentUser.name,
          operation_details: {
            originalSchedule: originalSchedule,
            updatedSchedule: updatedSchedule,
            changes: {
              type: originalSchedule.type !== updatedSchedule.type,
              title: originalSchedule.title !== updatedSchedule.title,
              startTime: originalSchedule.startTime !== updatedSchedule.startTime,
              endTime: originalSchedule.endTime !== updatedSchedule.endTime,
              participants: JSON.stringify(originalSchedule.participants) !== JSON.stringify(updatedSchedule.participants)
            }
          }
        });
      }

      // Google Calendar自動同期（単一予定）
      try {
        const { simpleSyncService } = await import('../services/simpleSyncService');
        await simpleSyncService.syncSingleScheduleToGoogle(updatedSchedule, currentUser?.id || '');
        console.log('✅ Google Calendar単一予定同期完了 (update):', updatedSchedule.title);
      } catch (error) {
        console.error('❌ Google Calendar単一予定同期エラー:', error);
        // エラーでも予定更新は継続
      }

      // Send update notifications
      try {
        // Detect changes
        const changes: string[] = [];
        if (originalSchedule.title !== updatedSchedule.title) {
          changes.push(`タイトル: ${originalSchedule.title} → ${updatedSchedule.title}`);
        }
        if (originalSchedule.startTime.getTime() !== updatedSchedule.startTime.getTime() ||
            originalSchedule.endTime.getTime() !== updatedSchedule.endTime.getTime()) {
          changes.push('日時が変更されました');
        }
        if (originalSchedule.meetLink !== updatedSchedule.meetLink) {
          changes.push('オンライン会議のリンクが変更されました');
        }

        // Notify all participants (including new ones)
        const allParticipants = new Set([...originalSchedule.participants, ...updatedSchedule.participants]);
        const participantPromises = Array.from(allParticipants).map(async (participantId) => {
          const { data: userData } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', participantId)
            .single();

          if (userData) {
            /* await notificationService.notifyScheduleUpdated({
              schedule: {
                id: updatedSchedule.id,
                title: updatedSchedule.title,
                type: updatedSchedule.type,
                startTime: updatedSchedule.startTime,
                endTime: updatedSchedule.endTime,
                details: updatedSchedule.details,
                meetLink: updatedSchedule.meetLink,
                participants: updatedSchedule.participants,
                location: getLocationFromEquipment(updatedSchedule.equipment)
              },
              user: {
                id: userData.id,
                name: userData.name,
                email: userData.email
              },
              changes
            }); */
          }
        });

        await Promise.all(participantPromises);
        
        // メール通知の送信（全参加者に一括送信）
        const allParticipantIds = Array.from(allParticipants);
        if (allParticipantIds.length > 0) {
          console.log('=== 更新メール通知送信開始 ===');
          
          const { data: participantsData, error: participantsError } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', allParticipantIds);
          
          if (participantsError) {
            console.error('参加者データ取得エラー:', participantsError);
          } else if (participantsData && participantsData.length > 0) {
            try {
              const emailSent = await scheduleNotificationService.sendScheduleUpdatedNotification(
                updatedSchedule,
                participantsData,
                currentUser?.name
              );
              
              if (emailSent) {
                console.log('✅ スケジュール変更メール通知送信成功');
              } else {
                console.log('❌ スケジュール変更メール通知送信失敗');
              }
            } catch (emailError) {
              console.error('メール通知送信エラー:', emailError);
            }
          }
          
          console.log('=== 更新メール通知送信完了 ===');
        }
        
      } catch (error) {
        console.error('Notification error:', error);
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error('予約の更新中にエラーが発生しました');
    }
  }, [schedules]);

  const deleteSchedule = useCallback(async (scheduleId: string, deletedBy?: string, reason?: string, deleteAllRecurring: boolean = false) => {
    try {
      console.log('🗑️ deleteSchedule called:', { scheduleId, deleteAllRecurring });
      
      // 繰り返し予約のインスタンスIDから元のスケジュールIDを抽出
      let actualScheduleId = scheduleId;
      let isRecurringInstance = false;
      
      // インスタンスIDの形式: originalId_timestamp
      if (scheduleId.includes('_') && scheduleId.length > 36) {
        const underscoreIndex = scheduleId.lastIndexOf('_');
        if (underscoreIndex > 0) {
          actualScheduleId = scheduleId.substring(0, underscoreIndex);
          isRecurringInstance = true;
          console.log('🔄 繰り返し予約のインスタンスIDを検出:', {
            instanceId: scheduleId,
            originalId: actualScheduleId
          });
        }
      }
      
      // Get the schedule to be deleted
      const scheduleToDelete = schedules.find(s => s.id === actualScheduleId);
      if (!scheduleToDelete) {
        console.error('Schedule not found:', actualScheduleId);
        toast.error('削除する予約が見つかりません');
        return;
      }

      console.log('🗑️ 削除対象のスケジュール:', {
        id: scheduleToDelete.id,
        title: scheduleToDelete.title,
        original_id: scheduleToDelete.original_id,
        deleteAllRecurring
      });

      let schedulesToDelete: Schedule[] = [];
      let deleteDescription = '';

      // 繰り返し予約の処理
      // 繰り返し予約の判定：recurrence情報があるか、original_idが設定されている場合
      const isRecurringSchedule = (scheduleToDelete.recurrence && scheduleToDelete.recurrence.frequency !== 'none') || 
                                 scheduleToDelete.original_id !== null;
      
      if (isRecurringSchedule) {
        if (deleteAllRecurring) {
          // 繰り返し予約のすべてのインスタンスを削除
          // より確実な方法で関連スケジュールを特定
          const originalId = scheduleToDelete.original_id || scheduleToDelete.id;
          schedulesToDelete = schedules.filter(s => {
            // 元のスケジュール（original_idがnull）または
            // このスケジュールをoriginal_idとして参照しているインスタンス
            return s.id === originalId || s.original_id === originalId;
          });
          deleteDescription = `繰り返し予約「${scheduleToDelete.title}」のすべてのインスタンスを削除しました`;
          console.log('🔄 繰り返し予約全体を削除:', schedulesToDelete.length, '件');
          console.log('🔄 削除対象:', schedulesToDelete.map(s => ({ id: s.id, title: s.title, original_id: s.original_id })));
        } else if (isRecurringInstance) {
          // 繰り返し予約の特定のインスタンスのみを削除
          schedulesToDelete = [scheduleToDelete];
          deleteDescription = `繰り返し予約「${scheduleToDelete.title}」のこのインスタンスを削除しました`;
          console.log('🗑️ 繰り返し予約の特定インスタンスを削除');
        } else {
          // 通常の繰り返し予約削除
          schedulesToDelete = [scheduleToDelete];
          deleteDescription = reason || `スケジュール「${scheduleToDelete.title}」を削除しました`;
          console.log('🗑️ 繰り返し予約を削除');
        }
      } else {
        // 通常のスケジュール削除
        schedulesToDelete = [scheduleToDelete];
        deleteDescription = reason || `スケジュール「${scheduleToDelete.title}」を削除しました`;
        console.log('🗑️ 通常スケジュールを削除');
      }

      // データベースから削除（外部キー制約を考慮して順序を調整）
      const scheduleIds = schedulesToDelete.map(s => s.id);
      
      if (deleteAllRecurring && isRecurringSchedule) {
        // 繰り返し予約の全削除の場合：すべてのスケジュールを一度に削除
        console.log('🔄 繰り返し予約の全インスタンスを削除:', scheduleIds);
        
        // まず、このスケジュールを参照している他のスケジュールを削除
        const originalId = scheduleToDelete.original_id || scheduleToDelete.id;
        const { error: deleteReferencesError } = await supabase
          .from('schedules')
          .delete()
          .eq('original_id', originalId);

        if (deleteReferencesError) {
          console.error('Error deleting referenced schedules:', deleteReferencesError);
          toast.error('関連する予約の削除に失敗しました');
          return;
        }

        // 次に、元のスケジュールとすべてのインスタンスを削除
        const { error } = await supabase
          .from('schedules')
          .delete()
          .in('id', scheduleIds);

        if (error) {
          console.error('Error deleting all recurring schedules:', error);
          toast.error('繰り返し予約の削除に失敗しました');
          return;
        }
      } else {
        // 通常の削除処理
        // まず、このスケジュールを参照している他のスケジュールを削除
        const { error: deleteReferencesError } = await supabase
          .from('schedules')
          .delete()
          .eq('original_id', scheduleIds[0]);

        if (deleteReferencesError) {
          console.error('Error deleting referenced schedules:', deleteReferencesError);
          toast.error('関連する予約の削除に失敗しました');
          return;
        }

        // 次に、元のスケジュールを削除
        const { error } = await supabase
          .from('schedules')
          .delete()
          .in('id', scheduleIds);

        if (error) {
          console.error('Error deleting schedule(s):', error);
          toast.error('予約の削除に失敗しました');
          return;
        }
      }

      // 操作履歴を記録
      for (const schedule of schedulesToDelete) {
      const { error: historyError } = await supabase
        .from('schedule_history')
        .insert({
            schedule_id: schedule.id,
          operation_type: 'delete',
          operator_id: deletedBy || currentUser?.id || '',
          operator_name: currentUser?.name || '不明',
            description: deleteDescription,
            schedule_data: schedule
        });

      if (historyError) {
        console.error('Error saving schedule history:', historyError);
        }
      }

      // ローカル状態から削除（参照されているスケジュールも含めて）
      setSchedules(current => {
        let filtered = current;
        
        if (deleteAllRecurring && isRecurringSchedule) {
          // 繰り返し予約の全削除の場合：original_idで関連するすべてのスケジュールを削除
          const originalId = scheduleToDelete.original_id || scheduleToDelete.id;
          filtered = current.filter(schedule => {
            // 元のスケジュールまたは関連するインスタンスを削除
            return schedule.id !== originalId && schedule.original_id !== originalId;
          });
          console.log('🔄 ローカル状態から繰り返し予約全体を削除:', {
            before: current.length,
            after: filtered.length,
            deleted: current.length - filtered.length,
            originalId: originalId
          });
        } else {
          // 通常の削除処理
          filtered = current.filter(schedule => {
            // 削除対象のスケジュールID
            if (scheduleIds.includes(schedule.id)) {
              return false;
            }
            // 削除対象のスケジュールを参照しているスケジュール
            if (scheduleIds.some(id => schedule.original_id === id)) {
              return false;
            }
            return true;
          });
          console.log('🗑️ ローカル状態から削除:', {
            before: current.length,
            after: filtered.length,
            deleted: current.length - filtered.length
          });
        }
        
        return filtered;
      });

      toast.success(deleteDescription);

      // 操作履歴を記録
      if (currentUser) {
        for (const schedule of schedulesToDelete) {
          await operationLogService.logOperation({
            operation_type: 'DELETE',
            target_type: 'SCHEDULE',
            target_id: schedule.id,
            target_title: schedule.title,
            operator_id: currentUser.id,
            operator_name: currentUser.name,
            operation_details: {
              deletedSchedule: schedule,
              deleteAllRecurring,
              reason,
              deletedBy: deletedBy || currentUser.id
            }
          });
        }
      }

      // Google Calendar自動同期（単一予定削除）
      try {
        const { simpleSyncService } = await import('../services/simpleSyncService');
        await simpleSyncService.deleteSingleScheduleFromGoogle(scheduleToDelete, currentUser?.id || '');
        console.log('✅ Google Calendar単一予定削除完了 (delete):', scheduleToDelete.title);
      } catch (error) {
        console.error('❌ Google Calendar単一予定削除エラー:', error);
        // エラーでも予定削除は継続
      }

      // Send deletion notifications
      try {
        const participantPromises = scheduleToDelete.participants.map(async (participantId) => {
          const { data: userData } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', participantId)
            .single();

          if (userData) {
            const { data: deletedByUser } = deletedBy ? await supabase
              .from('users')
              .select('name')
              .eq('id', deletedBy)
              .single() : { data: null };

            /* await notificationService.notifyScheduleDeleted({
              schedule: {
                id: scheduleToDelete.id,
                title: scheduleToDelete.title,
                type: scheduleToDelete.type,
                startTime: scheduleToDelete.startTime,
                endTime: scheduleToDelete.endTime,
                details: scheduleToDelete.details,
                meetLink: scheduleToDelete.meetLink,
                participants: scheduleToDelete.participants,
                location: getLocationFromEquipment(scheduleToDelete.equipment)
              },
              user: {
                id: userData.id,
                name: userData.name,
                email: userData.email
              },
              deletedBy: deletedByUser?.name,
              reason
            }); */
          }
        });

        await Promise.all(participantPromises);
        
        // メール通知の送信（全参加者に一括送信）
        if (scheduleToDelete.participants.length > 0) {
          console.log('=== 削除メール通知送信開始 ===');
          
          const { data: participantsData, error: participantsError } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', scheduleToDelete.participants);
          
          if (participantsError) {
            console.error('参加者データ取得エラー:', participantsError);
          } else if (participantsData && participantsData.length > 0) {
            try {
              const emailSent = await scheduleNotificationService.sendScheduleDeletedNotification(
                scheduleToDelete,
                participantsData
              );
              
              if (emailSent) {
                console.log('✅ スケジュール削除メール通知送信成功');
              } else {
                console.log('❌ スケジュール削除メール通知送信失敗');
              }
            } catch (emailError) {
              console.error('メール通知送信エラー:', emailError);
            }
          }
          
          console.log('=== 削除メール通知送信完了 ===');
        }
        
      } catch (error) {
        console.error('Notification error:', error);
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('予約の削除中にエラーが発生しました');
    }
  }, [schedules]);

  const getSchedulesForUser = useCallback((userId: string): Schedule[] => {
    return schedules.filter(schedule => 
      schedule.participants?.includes(userId) || 
      schedule.createdBy === userId ||
      (schedule.isFromGoogleCalendar && schedule.createdBy === userId)
    );
  }, [schedules]);

  const getSchedulesForEquipment = useCallback((equipmentId: string, type: 'room' | 'vehicle' | 'sample'): Schedule[] => {
    // サンプル予約は既にfetchSchedulesで除外されているため、
    // このメソッドは通常のカレンダーでは呼ばれても空配列を返す
    return schedules.filter(schedule => 
      schedule.equipment.some(eq => eq.id === equipmentId && eq.type === type)
    );
  }, [schedules]);

  // テスト用リマインダー送信関数
  const testReminder = useCallback(async (scheduleId: string, reminderMinutes: number = 15): Promise<boolean> => {
    try {
      console.log(`テストリマインダー送信: ${scheduleId} (${reminderMinutes}分前)`);
      // return await scheduleReminderService.testReminder(scheduleId, reminderMinutes);
      console.log('Test reminder temporarily disabled');
      return false;
    } catch (error) {
      console.error('テストリマインダー送信エラー:', error);
      return false;
    }
  }, []);

  // モバイルデバイスでは週表示のみを許可するsetViewラッパー
  const safeSetView = useCallback((newView: 'day' | 'week' | 'month') => {
    const isMobile = window.innerWidth < 640;
    if (isMobile && newView !== 'week') {
      // モバイルでは週表示のみ許可
      return;
    }
    setView(newView);
  }, []);

  return (
    <CalendarContext.Provider value={{
      currentDate,
      view,
      schedules,
      visibleUsers,
      goToTodayTriggered,
      setCurrentDate,
      setView: setViewWithLog,
      goToNextPeriod,
      goToPreviousPeriod,
      goToToday,
      setGoToTodayTriggered,
      toggleUserVisibility,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      getSchedulesForDate,
      getSchedulesForDateRange,
      getSchedulesForUser,
      getSchedulesForEquipment,
      checkScheduleConflicts,
      refreshSchedules: fetchSchedules,
      testReminder,
    }}>
      {children}
    </CalendarContext.Provider>
  );
}

// Helper function to get location from equipment
function getLocationFromEquipment(equipment: any[]): string | undefined {
  if (!equipment || equipment.length === 0) return undefined;
  
  const rooms = equipment.filter(e => e.type === 'room');
  if (rooms.length > 0) {
    return rooms.map(r => r.name).join(', ');
  }
  
  return undefined;
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}