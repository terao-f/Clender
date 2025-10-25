import { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, Video, VideoOff, Users as UsersIcon, Link, Copy } from 'lucide-react';
import { format, addHours, setMinutes, setHours } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Schedule, Equipment } from '../types';
import { mockUsers } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import ParticipantSelector from './ParticipantSelector';
import ConfirmationModal from './ConfirmationModal';
import { useConfirmation } from '../hooks/useConfirmation';
import toast from 'react-hot-toast';
import { 
  generateGoogleMeetLink, 
  supportsMeetLink, 
  getDefaultMeetingType, 
  shouldAutoGenerateMeetLink,
  isValidMeetLink,
  getMeetingTypeDisplay,
  getMeetingTypeStyles
} from '../utils/googleMeet';
import { googleCalendarService } from '../services/googleCalendarService';

// terao.form@gmail.comのユーザーID（Google Meet URL発行スケジュールの自動参加者）
const TERAO_FORM_USER_ID = 'f293566d-cbda-48b0-94dd-51780683f975';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (schedule: Partial<Schedule>) => void;
  selectedDate?: Date;
  selectedEquipment?: Equipment;
  selectedParticipant?: string;
  type: 'room' | 'vehicle' | 'sample' | 'general';
  editingSchedule?: Schedule;
}

export default function ReservationModal({
  isOpen,
  onClose,
  onSubmit,
  selectedDate,
  selectedEquipment,
  selectedParticipant,
  type,
  editingSchedule
}: ReservationModalProps) {
  const { currentUser } = useAuth();
  const { confirm, confirmationState, handleConfirm, handleCancel } = useConfirmation();
  
  // Initialize form data
  const getInitialFormData = () => {
    if (editingSchedule) {
      return {
        ...editingSchedule,
        startTime: new Date(editingSchedule.startTime),
        endTime: new Date(editingSchedule.endTime),
        participants: editingSchedule.participants || []
      };
    }
    
    const now = selectedDate || new Date();
    const startTime = setMinutes(setHours(now, 9), 0); // 9:00 AM default
    const endTime = addHours(startTime, 1); // 1 hour default
    
    // サンプル予約の場合、特別な初期値を設定
    const scheduleType = type === 'sample' ? 'サンプル作成' : '会議';
    const defaultMeetingType = type === 'sample' ? 'in-person' : getDefaultMeetingType(scheduleType);
    
    const initialData = {
      type: scheduleType,
      title: '',
      details: '',
      startTime,
      endTime,
      isAllDay: false,
      isPrivate: false,
      participants: (() => {
        const participantList = [];
        // 本人（ログインユーザー）を追加
        if (currentUser) {
          participantList.push(currentUser.id);
        }
        // 選択された行のユーザーを追加（本人と異なる場合のみ）
        if (selectedParticipant && selectedParticipant !== currentUser?.id) {
          participantList.push(selectedParticipant);
        }
        return participantList;
      })(),
      equipment: selectedEquipment ? [{ id: selectedEquipment.id, name: selectedEquipment.name || '', type: selectedEquipment.type }] : [],
      meetingType: defaultMeetingType,
      meetLink: '' // Google Meetリンクは作成時に自動生成
    };
    
    // サンプル予約の場合、担当者を設定
    if (type === 'sample' && currentUser) {
      initialData.assignedTo = currentUser.id;
      initialData.assigned_to = currentUser.id;
    }
    
    return initialData;
  };
  
  const [formData, setFormDataInternal] = useState<Partial<Schedule>>(getInitialFormData());
  
  // デバッグ用: formDataの変更を監視
  useEffect(() => {
    console.log('=== formData変更検出 ===');
    console.log('現在のtype:', formData.type);
    console.log('現在のmeetingType:', formData.meetingType);
    console.log('完全なformData:', formData);
  }, [formData]);
  
  // setFormDataのラッパー関数（デバッグ用）
  const setFormData = (newData: any) => {
    console.log('=== setFormData呼び出し ===');
    console.log('呼び出し元スタック:', new Error().stack);
    console.log('新しいデータ:', newData);
    if (typeof newData === 'function') {
      setFormDataInternal(prevData => {
        const result = newData(prevData);
        console.log('前のデータ:', prevData);
        console.log('結果データ:', result);
        return result;
      });
    } else {
      console.log('直接設定:', newData);
      setFormDataInternal(newData);
    }
  };
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [isGeneratingMeetLink, setIsGeneratingMeetLink] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [availableSampleEquipment, setAvailableSampleEquipment] = useState<any[]>([]);
  const [conflictingSchedules, setConflictingSchedules] = useState<Schedule[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [creatorUser, setCreatorUser] = useState<any>(null);
  const [updaterUser, setUpdaterUser] = useState<any>(null);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);
  const [sendEmailOnSave, setSendEmailOnSave] = useState(true); // デフォルトで有効
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTargetDate, setCopyTargetDate] = useState<string>('');
  const [nextSampleNumber, setNextSampleNumber] = useState<number>(1);
  
  // サンプル予約用のフィールド
  const [productionNumber, setProductionNumber] = useState(type === 'sample' ? 'S' : '');
  const [productCode, setProductCode] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(type === 'sample' ? 1 : '');
  const [assignedTo, setAssignedTo] = useState(type === 'sample' && currentUser ? currentUser.id : '');
  
  // Load equipment data and user info
  useEffect(() => {
    if (isOpen) {
      loadEquipment();
      if (editingSchedule) {
        // 既存スケジュールの会議形式が「オンライン」の場合、terao.form@gmail.comを参加者に自動追加
        if (editingSchedule.meetingType === 'online') {
          const currentParticipants = editingSchedule.participants || [];
          
          // terao.form@gmail.comが既に参加者に含まれていない場合のみ追加
          if (!currentParticipants.includes(TERAO_FORM_USER_ID)) {
            const updatedSchedule = {
              ...editingSchedule,
              participants: [...currentParticipants, TERAO_FORM_USER_ID]
            };
            setFormData(updatedSchedule);
            console.log('✅ 既存のオンライン会議のため、terao.form@gmail.comを参加者に自動追加しました');
          } else {
            setFormData(editingSchedule);
          }
        } else {
          setFormData(editingSchedule);
        }
        loadUserInfo();
        loadEmailHistory();
        // サンプル予約の場合、タイトルから情報を抽出
        if (type === 'sample' && editingSchedule.title) {
          const parts = editingSchedule.title.split('・');
          if (parts.length >= 3) {
            setProductionNumber(parts[0]);
            setProductCode(parts[1]);
            const qtyMatch = parts[2].match(/(\d+)枚/);
            if (qtyMatch) {
              setQuantity(parseInt(qtyMatch[1]));
            }
          }
        }
        // 既存のデータから設定
        if (editingSchedule.quantity) setQuantity(editingSchedule.quantity);
        if (editingSchedule.assigned_to) {
          setAssignedTo(editingSchedule.assigned_to);
        } else if (editingSchedule.assignedTo) {
          setAssignedTo(editingSchedule.assignedTo);
        }
      } else {
        // 新規作成時は初期データを設定
        // サンプル予約の場合は完全にリセット
        if (type === 'sample') {
          console.log('サンプル予約の新規作成 - 完全リセット');
          setFormData(getInitialFormData());
        } else {
          // その他の予約タイプは既存のロジックを維持
          setFormData(prevData => {
            // 既にユーザーが種別を選択している場合はリセットしない
            if (prevData.type && prevData.type !== '会議') {
              console.log('種別が既に設定されているため初期化をスキップ:', prevData.type);
              return prevData;
            }
            console.log('初期データを設定');
            return getInitialFormData();
          });
        }
        setCreatorUser(null);
        setUpdaterUser(null);
        setProductionNumber(type === 'sample' ? 'S' : '');
        setProductCode('');
        setQuantity(type === 'sample' ? 1 : '');
        // サンプル予約の場合、担当者をログインユーザーに設定
        if (type === 'sample' && currentUser) {
          console.log('📌 サンプル予約の担当者を設定:', currentUser.id, currentUser.name);
          setAssignedTo(currentUser.id);
          // formDataにも反映（selectedEquipmentの情報も含める）
          setFormData(prevData => ({
            ...prevData,
            assignedTo: currentUser.id,
            assigned_to: currentUser.id,
            // selectedEquipmentの情報を設定
            equipment: selectedEquipment ? [{ id: selectedEquipment.id, type: selectedEquipment.type }] : []
          }));
        } else {
          setAssignedTo('');
        }
      }
    }
  }, [isOpen, editingSchedule, type]);
  
  // selectedDateが変更されたら日付フィールドを更新
  useEffect(() => {
    if (selectedDate && isOpen && !editingSchedule) {
      console.log('📅 selectedDateが設定されました:', selectedDate);
      const newStartTime = new Date(selectedDate);
      newStartTime.setHours(9, 0, 0, 0);
      const newEndTime = new Date(selectedDate);
      newEndTime.setHours(18, 0, 0, 0);
      
      setFormData(prevData => ({
        ...prevData,
        startTime: newStartTime,
        endTime: newEndTime
      }));
    }
  }, [selectedDate, isOpen, editingSchedule]);
  
  const loadEquipment = async () => {
    try {
      const [roomsRes, vehiclesRes, sampleRes] = await Promise.all([
        supabase.from('rooms').select('*').order('display_order, name'),
        supabase.from('vehicles').select('*').order('display_order, name'),
        supabase.from('sample_equipment').select('*').order('display_order, name')
      ]);
      
      if (roomsRes.data) setAvailableRooms(roomsRes.data);
      if (vehiclesRes.data) setAvailableVehicles(vehiclesRes.data);
      if (sampleRes.data) {
        setAvailableSampleEquipment(sampleRes.data);
        
        // サンプル予約の新規作成時、デフォルト設備を設定
        if (type === 'sample' && !editingSchedule) {
          const defaultEquipments = sampleRes.data
            .filter(eq => 
              eq.name === 'CAD・マーキング' || 
              eq.name === 'サンプル裁断' || 
              eq.name === 'サンプル縫製'
            )
            .map(eq => ({ 
              id: eq.id, 
              name: eq.name, 
              type: 'sample' 
            }));
          
          // formDataにデフォルト設備を設定
          setFormData(prevData => ({
            ...prevData,
            equipment: defaultEquipments
          }));
        }
      }
    } catch (error) {
      console.error('Error loading equipment:', error);
    }
  };

  // Load user information for creator and updater
  const loadUserInfo = async () => {
    if (!editingSchedule) return;
    
    try {
      const userIds = [editingSchedule.createdBy, editingSchedule.updatedBy].filter(Boolean);
      if (userIds.length === 0) return;
      
      const { data, error } = await supabase
        .from('users')
        .select('id, name, employee_id')
        .in('id', userIds);
      
      if (error) {
        console.error('Error loading user info:', error);
        return;
      }
      
      const creator = data?.find(u => u.id === editingSchedule.createdBy);
      const updater = data?.find(u => u.id === editingSchedule.updatedBy);
      
      setCreatorUser(creator || null);
      setUpdaterUser(updater || null);
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };


  // Load email send history
  const loadEmailHistory = async () => {
    if (!editingSchedule?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('email_send_history')
        .select('*')
        .eq('schedule_id', editingSchedule.id)
        .order('sent_at', { ascending: false });
      
      if (error) {
        console.error('Error loading email history:', error);
        return;
      }
      
      setEmailHistory(data || []);
    } catch (error) {
      console.error('Error loading email history:', error);
    }
  };

  // 15-minute interval time options
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeValue);
      }
    }
    return options;
  };
  
  const timeOptions = generateTimeOptions();
  
  // Handle meet link generation
  const handleGenerateMeetLink = async () => {
    console.log('Generate Meet Link button clicked');
    setIsGeneratingMeetLink(true);
    
    try {
      // まずプレースホルダーURLを生成（確実な動作保証）
      const guaranteedLink = generateGoogleMeetLink(
        formData.title || 'Google Meet会議',
        formData.startTime || new Date()
      );
      
      try {
        // 参加者のメールアドレスを取得
        let attendeeEmails: string[] = [];
        if (formData.participants && formData.participants.length > 0) {
          console.log('参加者IDを取得中:', formData.participants);
          
          const { data: participantsData, error: participantsError } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', formData.participants);
          
          if (participantsError) {
            console.error('参加者データ取得エラー:', participantsError);
          } else if (participantsData && participantsData.length > 0) {
            attendeeEmails = participantsData
              .map(p => p.email)
              .filter(email => email && email.trim() !== '');
            console.log('参加者のメールアドレス:', attendeeEmails);
          }
        }
        
        // Google Calendar APIを試行
        const meetEvent = await googleCalendarService.createMeetEvent({
          title: formData.title || 'Google Meet会議',
          description: formData.details || '',
          startTime: formData.startTime || new Date(),
          endTime: formData.endTime || addHours(formData.startTime || new Date(), 1),
          attendees: attendeeEmails, // 参加者のメールアドレスを設定
          sendNotifications: false // 作成時は通知しない
        });
        
        if (meetEvent.meetLink) {
          setFormData(prevData => ({ 
            ...prevData, 
            meetingType: 'online', 
            meetLink: meetEvent.meetLink,
            googleCalendarEventId: meetEvent.calendarEventId
          }));
          
          
          toast.success('Google Meet URLを生成しました（あなたが主催者として設定されました）');
          console.log('Generated Meet Link:', meetEvent.meetLink);
        } else {
          // API呼び出し成功だがMeet URLなし
          setFormData(prevData => ({ 
            ...prevData, 
            meetingType: 'online', 
            meetLink: guaranteedLink 
          }));
          toast.info('プレースホルダーのGoogle Meet URLを生成しました');
          console.log('Fallback Meet Link:', guaranteedLink);
        }
      } catch (apiError) {
        // API呼び出し失敗時は確実にプレースホルダーURLを使用
        console.warn('Google Calendar API呼び出し失敗:', apiError);
        setFormData(prevData => ({ 
          ...prevData, 
          meetingType: 'online', 
          meetLink: guaranteedLink 
        }));
        toast.info('プレースホルダーのGoogle Meet URLを生成しました');
        console.log('Guaranteed Fallback Meet Link:', guaranteedLink);
      }
      
    } catch (error) {
      console.error('Meet Link generation error:', error);
      
      // エラー時のフォールバック: プレースホルダーURLを生成
      const fallbackLink = generateGoogleMeetLink(
        formData.title || 'Google Meet会議',
        formData.startTime || new Date()
      );
      setFormData(prevData => ({ 
        ...prevData, 
        meetingType: 'online', 
        meetLink: fallbackLink 
      }));
      
      // エラーの種類に応じたメッセージ
      if (error.message.includes('Failed to send a request to the Edge Function')) {
        toast.warning('サーバーとの通信に失敗しました。プレースホルダーURLを生成しました。');
      } else if (error.message.includes('timeout')) {
        toast.warning('リクエストがタイムアウトしました。プレースホルダーURLを生成しました。');
      } else {
        toast.warning('Google Meet URLの生成に失敗しました。プレースホルダーURLを生成しました。');
      }
    } finally {
      setIsGeneratingMeetLink(false);
    }
  };

  // Handle meeting type change
  const handleMeetingTypeChange = (newMeetingType: 'in-person' | 'online') => {
    const updates: Partial<Schedule> = { meetingType: newMeetingType };
    
    // Clear meet link for in-person meetings
    if (newMeetingType === 'in-person') {
      updates.meetLink = '';
    }
    
    // オンライン会議に変更した場合で、Google Meet URLが未設定なら自動生成
    if (newMeetingType === 'online' && !formData.meetLink) {
      // 非同期でGoogle Meet URLを生成
      handleGenerateMeetLink();
    }
    
    // オンライン会議に変更した場合、terao.form@gmail.comを参加者に自動追加（主催者として）
    if (newMeetingType === 'online') {
      const currentParticipants = formData.participants || [];
      
      // terao.form@gmail.comが既に参加者に含まれていない場合のみ追加
      if (!currentParticipants.includes(TERAO_FORM_USER_ID)) {
        updates.participants = [...currentParticipants, TERAO_FORM_USER_ID];
        console.log('✅ オンライン会議のため、terao.form@gmail.comを主催者として自動追加しました');
      }
    }
    
    setFormData({ ...formData, ...updates });
  };

  // Handle schedule type change and update meeting options
  const handleScheduleTypeChange = (newType: string) => {
    console.log('=== スケジュール種別変更 ===');
    console.log('新しい種別:', newType);
    
    const supportsMeet = supportsMeetLink(newType);
    const defaultMeetingType = getDefaultMeetingType(newType);
    const shouldAutoGenerate = shouldAutoGenerateMeetLink(newType);
    
    console.log('Meet対応:', supportsMeet);
    console.log('デフォルトミーティングタイプ:', defaultMeetingType);
    console.log('自動生成:', shouldAutoGenerate);
    
    const updates: Partial<Schedule> = {
      type: newType,
      meetingType: defaultMeetingType
    };
    
    if (!supportsMeet) {
      updates.meetLink = '';
      updates.meetingType = 'in-person';
    } else if (shouldAutoGenerate) {
      updates.meetingType = 'online';
      // 自動生成対象の場合は非同期でGoogle Meet URLを生成
      setTimeout(() => {
        handleGenerateMeetLink();
      }, 100); // フォーム更新後に実行
    }
    
    // オンライン会議（自動生成または手動選択）の場合、terao.form@gmail.comを参加者に自動追加
    if (updates.meetingType === 'online') {
      const currentParticipants = formData.participants || [];
      
      // terao.form@gmail.comが既に参加者に含まれていない場合のみ追加
      if (!currentParticipants.includes(TERAO_FORM_USER_ID)) {
        updates.participants = [...currentParticipants, TERAO_FORM_USER_ID];
        console.log('✅ スケジュール種別変更によりオンライン会議のため、terao.form@gmail.comを参加者に自動追加しました');
      }
    }
    
    console.log('適用する更新:', updates);
    const newFormData = { ...formData, ...updates };
    console.log('新しいフォームデータ:', newFormData);
    
    setFormData(newFormData);
  };
  
  // Check for schedule conflicts
  const checkConflicts = async (scheduleData: Partial<Schedule>) => {
    if (!scheduleData.participants || scheduleData.participants.length === 0) return [];
    
    // 空のparticipantsや無効なUUIDをフィルタリング
    const validParticipants = scheduleData.participants.filter(p => p && p.trim() !== '');
    if (validParticipants.length === 0) return [];
    
    try {
      let query = supabase
        .from('schedules')
        .select('*')
        .overlaps('participants', validParticipants)
        .gte('end_time', scheduleData.startTime?.toISOString())
        .lte('start_time', scheduleData.endTime?.toISOString());
      
      // 編集中のスケジュールがある場合のみ除外
      if (editingSchedule?.id) {
        query = query.neq('id', editingSchedule.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error checking conflicts:', error);
      return [];
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced Validation
    const errors = [];
    
    if (!formData.title?.trim()) {
      errors.push('タイトルを入力してください');
    }
    
    if (!formData.type) {
      errors.push('種別を選択してください');
    }
    
    if (!formData.startTime || !formData.endTime) {
      errors.push('日時を設定してください');
    } else if (formData.startTime >= formData.endTime) {
      errors.push('終了時刻は開始時刻より後に設定してください');
    }
    
    // サンプル予約以外の場合、参加者のチェック
    if (type !== 'sample') {
      // 参加者が誰も選ばれていない場合はエラー
      if (!formData.participants || formData.participants.length === 0) {
        if (!editingSchedule) {
          toast.error('⚠️ 参加者を選択してください');
          errors.push('参加者を選択してください');
        }
      } else {
        // 自分以外の参加者が選ばれているかチェック（警告のみ）
        const hasOtherParticipants = formData.participants.some(participantId => participantId !== currentUser?.id);
        
        if (!hasOtherParticipants && !editingSchedule) {
          // 警告を表示するが、処理は続行する
          toast('⚠️ 自分以外の参加者も選択することをお勧めします', {
            icon: '⚠️',
            style: {
              background: '#FEF3C7',
              color: '#92400E',
            },
          });
        }
      }
    }
    
    // カスタム繰り返しの場合、曜日のチェック
    if (formData.recurrence && formData.recurrence.frequency === 'custom') {
      if (!formData.recurrence.weekdays || formData.recurrence.weekdays.length === 0) {
        toast.error('⚠️ カスタム繰り返しでは曜日を少なくとも1つ選択してください');
        errors.push('カスタム繰り返しでは曜日を少なくとも1つ選択してください');
      }
    }
    
    // サンプル予約の場合の検証
    if (type === 'sample') {
      if (!productionNumber?.trim()) {
        errors.push('生産番号を入力してください');
      }
      if (!productCode?.trim()) {
        errors.push('品番を入力してください');
      }
      if (!quantity || quantity <= 0) {
        errors.push('枚数を入力してください');
      }
    }
    
    
    if (errors.length > 0) {
      // すべてのエラーをtoastで表示（最初のエラーは既に表示済みの場合があるので重複チェック）
      errors.forEach((error, index) => {
        if (index === 0 || !error.includes('参加者を選択してください')) {
          // 最初のエラーまたは参加者以外のエラーは表示
          if (!error.includes('参加者を選択してください')) {
            toast.error(error);
          }
        }
      });
      return;
    }
    
    // Check for conflicts (サンプル予約の場合はスキップ)
    if (type !== 'sample') {
      const conflicts = await checkConflicts(formData);
      if (conflicts.length > 0 && !showConflictModal) {
        setConflictingSchedules(conflicts);
        setShowConflictModal(true);
        return;
      }
    }
    
    // デバッグ用ログ
    console.log('=== フォーム送信処理開始 ===');
    console.log('送信時のformData:', formData);
    console.log('選択された種別:', formData.type);
    console.log('ミーティングタイプ:', formData.meetingType);
    console.log('Meet URL:', formData.meetLink);
    
    // 複数日予定として1つの予定を作成
    const submitData = {
      ...formData,
      createdBy: currentUser?.id,
      updatedBy: currentUser?.id,
      sendEmailOnSave // メール送信オプションを追加
    };
    
    console.log('送信するデータ:', submitData);
    
    // サンプル予約の場合、追加フィールドを設定
    if (type === 'sample') {
      submitData.production_number = productionNumber;
      submitData.product_code = productCode;
      submitData.quantity = quantity === '' ? undefined : quantity; // 枚数を追加
      submitData.assignedTo = assignedTo; // 担当者ID
      submitData.assigned_to = assignedTo; // DBフィールド名のため両方設定
      console.log('サンプル予約の担当者:', assignedTo);
      console.log('サンプル予約の枚数:', quantity);
    }
    
    console.log('🔴 onSubmit関数を呼び出します');
    console.log('  - onSubmit関数の存在:', typeof onSubmit);
    console.log('  - onSubmit:', onSubmit);
    
    try {
      onSubmit(submitData);
      console.log('🔴 onSubmit関数の呼び出し完了');
    } catch (error) {
      console.error('🔴 onSubmitでエラー発生:', error);
    }
    
    onClose();
    setShowConflictModal(false);
  };
  
  const handleForceSubmit = () => {
    const submitData = {
      ...formData,
      createdBy: currentUser?.id,
      updatedBy: currentUser?.id,
      sendEmailOnSave, // メール送信オプションを追加
      skipConflictCheck: true // 重複チェックをスキップするフラグ
    };
    
    // サンプル予約の場合、追加フィールドを設定
    if (type === 'sample') {
      submitData.production_number = productionNumber;
      submitData.product_code = productCode;
      submitData.quantity = quantity === '' ? undefined : quantity; // 枚数を追加
      submitData.assignedTo = assignedTo; // 担当者ID
      submitData.assigned_to = assignedTo; // DBフィールド名のため両方設定
      console.log('サンプル予約の担当者:', assignedTo);
      console.log('サンプル予約の枚数:', quantity);
    }
    
    console.log('🔴 [handleSubmitAnyway] onSubmit関数を呼び出します');
    console.log('  - onSubmit関数の存在:', typeof onSubmit);
    
    try {
      onSubmit(submitData);
      console.log('🔴 [handleSubmitAnyway] onSubmit関数の呼び出し完了');
    } catch (error) {
      console.error('🔴 [handleSubmitAnyway] onSubmitでエラー発生:', error);
    }
    
    onClose();
    setShowConflictModal(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {editingSchedule ? '予約編集' : '予約作成'}
          </h3>
          <div className="flex items-center space-x-3">
            {/* 非公開設定 */}
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isPrivate || false}
                onChange={(e) => {
                  setFormDataInternal(prev => ({
                    ...prev,
                    isPrivate: e.target.checked
                  }));
                }}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label className="ml-2 text-sm text-gray-700">非公開</label>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. 種別選択 */}
          {(type === 'general' || type === 'room' || type === 'vehicle') && (
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">種別</label>
              <select
                value={formData.type || ''}
                onChange={(e) => handleScheduleTypeChange(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">選択してください</option>
                <option value="会議">会議</option>
                <option value="オンライン商談">オンライン商談</option>
                <option value="15分無料相談">15分無料相談</option>
                <option value="来訪">来訪</option>
                <option value="工事">工事</option>
                <option value="外出">外出</option>
                <option value="出張">出張</option>
                <option value="面接">面接</option>
                <option value="その他">その他</option>
              </select>
            </div>
          )}
          
          {/* 2. タイトル - サンプル予約の場合は自動生成 */}
          {type === 'sample' ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">生産番号</label>
                  <input
                    type="text"
                    value={productionNumber}
                    onChange={(e) => {
                      let value = e.target.value;
                      // 空の場合は"S"を設定
                      if (value === '') {
                        value = 'S';
                      }
                      // "S"で始まらない場合は、先頭に"S"を追加
                      else if (!value.startsWith('S')) {
                        // 最初の文字を削除して"S"を先頭に追加
                        value = 'S' + value.substring(1);
                      }
                      setProductionNumber(value);
                      // タイトルを自動生成
                      const title = `${value}・${productCode}・${quantity}枚`;
                      setFormData({ ...formData, title });
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">品番</label>
                  <input
                    type="text"
                    value={productCode}
                    onChange={(e) => {
                      setProductCode(e.target.value);
                      // タイトルを自動生成
                      const title = `${productionNumber}・${e.target.value}・${quantity}枚`;
                      setFormData({ ...formData, title });
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">枚数</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value);
                      // マイナス値を防ぐ
                      if (val !== '' && val < 1) return;
                      setQuantity(val);
                      // タイトルを自動生成
                      const title = `${productionNumber}・${productCode}・${val}枚`;
                      setFormData({ ...formData, title, quantity: val === '' ? undefined : val });
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <ParticipantSelector
                  selectedParticipants={assignedTo ? [assignedTo] : []}
                  onChange={(participants) => {
                    const newAssignedTo = participants[0] || '';
                    setAssignedTo(newAssignedTo);
                    // 担当者を参加者として設定（メール通知用）
                    setFormData({ 
                      ...formData, 
                      assignedTo: newAssignedTo, 
                      assigned_to: newAssignedTo,
                      participants: participants // 担当者を参加者として設定
                    });
                  }}
                  label="担当者"
                  singleSelect={true}
                  sampleStaffOnly={true}
                  showBusinessGroups={false}
                  showLeaveGroups={false}
                />
              </div>
            </>
          ) : (
            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
              <label className="block text-sm font-semibold text-blue-900 mb-2">
                <span className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  タイトル
                </span>
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="予定のタイトルを入力してください"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg font-medium px-4 py-3 bg-white"
                required
              />
              <p className="mt-2 text-xs text-blue-700">
                ※ この予定を識別するための名前を入力してください
              </p>
            </div>
          )}
          
          {/* 3. 詳細 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{type === 'sample' ? '備考' : '詳細'}</label>
            <textarea
              value={formData.details || ''}
              onChange={(e) => {
                setFormData({ ...formData, details: e.target.value });
                if (type === 'sample') {
                  setFormData({ ...formData, details: e.target.value, notes: e.target.value });
                }
              }}
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          {/* 4. 日付 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">日付</label>
            <div 
              className="relative cursor-pointer group"
              onClick={() => {
                // 日付入力フィールドにフォーカスを当てる
                const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
                if (dateInput) {
                  dateInput.focus();
                  dateInput.showPicker?.();
                }
              }}
            >
              <input
                type="date"
                value={formData.startTime ? format(formData.startTime, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const selectedDate = new Date(e.target.value);
                  const currentStart = formData.startTime || new Date();
                  const currentEnd = formData.endTime || new Date();
                  
                  const newStart = new Date(selectedDate);
                  newStart.setHours(currentStart.getHours(), currentStart.getMinutes());
                  
                  const newEnd = new Date(selectedDate);
                  newEnd.setHours(currentEnd.getHours(), currentEnd.getMinutes());
                  
                  setFormData({ ...formData, startTime: newStart, endTime: newEnd });
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm cursor-pointer hover:border-gray-400 transition-colors duration-200 group-hover:border-indigo-300"
                required
                style={{ 
                  paddingRight: '40px',
                  cursor: 'pointer'
                }}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* 5. 終日設定 - サンプル予約以外の場合のみ表示 */}
              {type !== 'sample' && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={formData.isAllDay || false}
                    onChange={(e) => {
                      const isAllDay = e.target.checked;
                      if (isAllDay) {
                        // 終日の場合、時刻を0:00-23:59に設定
                        const startDate = new Date(formData.startTime || new Date());
                        startDate.setHours(0, 0, 0, 0);
                        const endDate = new Date(formData.endTime || formData.startTime || new Date());
                        endDate.setHours(23, 59, 59, 999);
                        setFormData({ 
                          ...formData, 
                          isAllDay: isAllDay,
                          startTime: startDate,
                          endTime: endDate
                        });
                      } else {
                        // 時刻指定に戻す場合、デフォルトの時刻を設定
                        const startDate = new Date(formData.startTime || new Date());
                        startDate.setHours(9, 0, 0, 0);
                        const endDate = new Date(formData.endTime || formData.startTime || new Date());
                        endDate.setHours(18, 0, 0, 0);
                        setFormData({ 
                          ...formData, 
                          isAllDay: isAllDay,
                          startTime: startDate,
                          endTime: endDate
                        });
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">終日</label>
                </div>

              
              {!formData.isAllDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {formData.isMultiDay ? '開始日時' : '開始時刻'}
                    </label>
                    <select
                      value={formData.startTime ? format(formData.startTime, 'HH:mm') : ''}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        const newStartTime = new Date(formData.startTime || new Date());
                        newStartTime.setHours(hours, minutes, 0, 0);
                        setFormData({ ...formData, startTime: newStartTime });
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    >
                      {timeOptions.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                    {formData.isMultiDay && formData.startTime && (
                      <p className="mt-1 text-xs text-gray-500">
                        {format(formData.startTime, 'M月d日', { locale: ja })}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {formData.isMultiDay ? '終了日時' : '終了時刻'}
                    </label>
                    <select
                      value={formData.endTime ? format(formData.endTime, 'HH:mm') : ''}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        const newEndTime = new Date(formData.endTime || new Date());
                        newEndTime.setHours(hours, minutes, 0, 0);
                        setFormData({ ...formData, endTime: newEndTime });
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    >
                      {timeOptions.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                    {formData.isMultiDay && formData.endTime && (
                      <p className="mt-1 text-xs text-gray-500">
                        {format(formData.endTime, 'M月d日', { locale: ja })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 6. 複数日設定（サンプル予約以外） */}
          {type !== 'sample' && formData.type !== '休暇' && (
            <div className={`p-4 rounded-lg border ${formData.recurrence ? 'bg-gray-100 opacity-60' : 'bg-gray-50'}`}>
              <label className="block text-sm font-medium text-gray-700">複数日の予定</label>
              {formData.recurrence && (
                <p className="text-xs text-gray-500 mt-1">※ 繰り返し設定が有効なため、複数日設定は無効です</p>
              )}
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="multi-day"
                    checked={!!formData.isMultiDay}
                    disabled={!!formData.recurrence}
                    onChange={(e) => {
                      if (e.target.checked) {
                        // 複数日予定の場合、終了日を開始日と同じに初期設定
                        const endDate = new Date(formData.startTime || new Date());
                        endDate.setHours(23, 59, 59, 999);
                        setFormData({ 
                          ...formData, 
                          isMultiDay: true,
                          endTime: endDate,
                          recurrence: null // 繰り返し設定を無効にする
                        });
                      } else {
                        // 単日予定に戻す場合、終了時刻を開始時刻の1時間後に設定
                        const startTime = formData.startTime || new Date();
                        const endTime = new Date(startTime);
                        endTime.setHours(startTime.getHours() + 1);
                        setFormData({
                          ...formData,
                          isMultiDay: false,
                          endTime: endTime
                        });
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="multi-day" className="ml-2 text-sm text-gray-700">
                    複数日にまたがる予定
                  </label>
                </div>
                
                {formData.isMultiDay && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700">終了日</label>
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => {
                        // 終了日入力フィールドにフォーカスを当てる
                        const endDateInput = document.querySelector('input[type="date"][min]') as HTMLInputElement;
                        if (endDateInput) {
                          endDateInput.focus();
                          endDateInput.showPicker?.();
                        }
                      }}
                    >
                      <input
                        type="date"
                        value={formData.endTime ? format(formData.endTime, 'yyyy-MM-dd') : ''}
                        min={formData.startTime ? format(formData.startTime, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                          const endDate = new Date(e.target.value);
                          // 終了日は現在の終了時刻を保持（終日でない場合）
                          if (!formData.isAllDay && formData.endTime) {
                            endDate.setHours(formData.endTime.getHours(), formData.endTime.getMinutes(), 0, 0);
                          } else {
                            endDate.setHours(23, 59, 59, 999);
                          }
                          setFormData({
                            ...formData,
                            endTime: endDate
                          });
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm cursor-pointer hover:border-gray-400 transition-colors duration-200 group-hover:border-indigo-300"
                        style={{ 
                          paddingRight: '40px',
                          cursor: 'pointer'
                        }}
                        required
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.startTime && formData.endTime && 
                        `${format(formData.startTime, 'M月d日', { locale: ja })}〜${format(formData.endTime, 'M月d日', { locale: ja })}の期間で1つの予定として登録されます`
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* サンプル予約の場合は順番のみ表示 */}
          {type === 'sample' && (
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700">作業順序</label>
              <p className="mt-1 text-sm text-gray-600">
                登録時に自動的に順番が割り当てられます（早い者順）
              </p>
            </div>
          )}
          
          {/* 7. 繰り返し設定 - サンプル予約以外の場合のみ表示 */}
          {type !== 'sample' && (
            <div className={`border border-gray-200 rounded-lg p-4 ${formData.isMultiDay ? 'bg-gray-100 opacity-60' : ''}`}>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">繰り返し</label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="recurrence-enabled"
                    checked={!!formData.recurrence}
                    disabled={!!formData.isMultiDay}
                    onChange={(e) => {
                      if (e.target.checked) {
                        // 繰り返し設定を有効にする場合、複数日設定を無効にする
                        const startTime = formData.startTime || new Date();
                        const endTime = new Date(startTime);
                        endTime.setHours(startTime.getHours() + 1);
                        
                        setFormData({
                          ...formData,
                          isMultiDay: false, // 複数日設定を無効にする
                          endTime: endTime, // 終了時刻を1時間後に設定
                          recurrence: {
                            frequency: 'weekly',
                            interval: 1,
                            endType: 'date',
                            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日後をデフォルト
                            count: null,
                            weekdays: []
                          }
                        });
                      } else {
                        setFormData({ ...formData, recurrence: null });
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="recurrence-enabled" className="ml-2 text-sm text-gray-700">繰り返しを有効にする</label>
                </div>
              </div>
              {formData.isMultiDay && (
                <p className="text-xs text-gray-500 mb-2">※ 複数日設定が有効なため、繰り返し設定は無効です</p>
              )}
              {formData.recurrence && (
                <div className="space-y-3">
                  <div>
                    <select
                      value={formData.recurrence.frequency}
                      disabled={!!formData.isMultiDay}
                      onChange={(e) => {
                        const frequency = e.target.value;
                        setFormData({
                          ...formData,
                          recurrence: {
                            ...formData.recurrence!,
                            frequency,
                            weekdays: frequency === 'custom' ? [] : null
                          }
                        });
                      }}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="daily">毎日</option>
                      <option value="weekly">毎週</option>
                      <option value="monthly">毎月</option>
                      <option value="yearly">毎年</option>
                      <option value="weekdays">平日のみ</option>
                      <option value="custom">カスタム</option>
                    </select>
                  </div>
                
                {formData.recurrence && formData.recurrence.frequency !== 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600">間隔</label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={formData.recurrence.interval || 1}
                        disabled={!!formData.isMultiDay}
                        onChange={(e) => setFormData({
                          ...formData,
                          recurrence: {
                            ...formData.recurrence!,
                            interval: parseInt(e.target.value)
                          }
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600">終了日</label>
                      <div 
                        className="relative cursor-pointer group"
                        onClick={(e) => {
                          // 繰り返し終了日入力フィールドに直接フォーカスを当てる
                          if (!formData.isMultiDay) {
                            const targetInput = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement;
                            if (targetInput) {
                              targetInput.focus();
                              targetInput.showPicker?.();
                            }
                          }
                        }}
                      >
                        <input
                          type="date"
                          value={formData.recurrence.endDate ? format(new Date(formData.recurrence.endDate), 'yyyy-MM-dd') : ''}
                          disabled={!!formData.isMultiDay}
                          onChange={(e) => setFormData({
                            ...formData,
                            recurrence: {
                              ...formData.recurrence!,
                              endDate: new Date(e.target.value)
                            }
                          })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm cursor-pointer hover:border-gray-400 transition-colors duration-200 group-hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ 
                            paddingRight: '40px',
                            cursor: formData.isMultiDay ? 'not-allowed' : 'pointer'
                          }}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                
                
                {formData.recurrence && formData.recurrence.frequency === 'custom' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">曜日選択</label>
                      <div className="grid grid-cols-7 gap-1">
                        {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                          <label key={index} className="flex flex-col items-center">
                            <input
                              type="checkbox"
                              checked={formData.recurrence?.weekdays?.includes(index) || false}
                              disabled={!!formData.isMultiDay}
                              onChange={(e) => {
                                const weekdays = formData.recurrence?.weekdays || [];
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    recurrence: {
                                      ...formData.recurrence!,
                                      weekdays: [...weekdays, index]
                                    }
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    recurrence: {
                                      ...formData.recurrence!,
                                      weekdays: weekdays.filter(d => d !== index)
                                    }
                                  });
                                }
                              }}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-gray-600 mt-1">{day}</span>
                          </label>
                        ))}
                      </div>
                      {formData.recurrence && formData.recurrence.frequency === 'custom' && (!formData.recurrence.weekdays || formData.recurrence.weekdays.length === 0) && (
                        <div className="text-red-500 text-xs mt-1">
                          曜日を少なくとも1つ選択してください
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600">終了日</label>
                      <div 
                        className="relative cursor-pointer group"
                        onClick={(e) => {
                          // 繰り返し終了日入力フィールドに直接フォーカスを当てる
                          if (!formData.isMultiDay) {
                            const targetInput = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement;
                            if (targetInput) {
                              targetInput.focus();
                              targetInput.showPicker?.();
                            }
                          }
                        }}
                      >
                        <input
                          type="date"
                          value={formData.recurrence.endDate ? format(new Date(formData.recurrence.endDate), 'yyyy-MM-dd') : ''}
                          disabled={!!formData.isMultiDay}
                          onChange={(e) => setFormData({
                            ...formData,
                            recurrence: {
                              ...formData.recurrence!,
                              endDate: new Date(e.target.value)
                            }
                          })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm cursor-pointer hover:border-gray-400 transition-colors duration-200 group-hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ 
                            paddingRight: '40px',
                            cursor: formData.isMultiDay ? 'not-allowed' : 'pointer'
                          }}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>
          )}
          
          {/* 7. 参加者選択 */}
          {(
            <div className={`border rounded-lg p-4 ${
              !editingSchedule && (!formData.participants || formData.participants.length === 0)
                ? 'border-red-300 bg-red-50'
                : !editingSchedule && formData.participants && 
                  !formData.participants.some(id => id !== currentUser?.id)
                  ? 'border-yellow-300 bg-yellow-50' 
                  : 'border-gray-200'
            }`}>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                参加者
                {!editingSchedule && (!formData.participants || formData.participants.length === 0) && (
                  <span className="ml-2 text-sm text-red-600">※ 参加者を選択してください</span>
                )}
                {!editingSchedule && formData.participants && formData.participants.length > 0 &&
                 !formData.participants.some(id => id !== currentUser?.id) && (
                  <span className="ml-2 text-sm text-yellow-600">※ 自分以外の参加者も選択することをお勧めします</span>
                )}
              </label>
              <ParticipantSelector
                selectedParticipants={formData.participants || []}
                onChange={(participants) => setFormData({ ...formData, participants })}
                showBusinessGroups={true}
                showLeaveGroups={false}
              />
            </div>
          )}
          
          {/* 8. 会議室 - サンプル予約以外の場合のみ表示 */}
          {type !== 'sample' && (
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">会議室</label>
              <div className="space-y-1">
                {availableRooms.map(room => (
                  <label key={room.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={(formData.equipment || []).some(eq => eq.id === room.id && eq.type === 'room')}
                      onChange={(e) => {
                        const equipment = formData.equipment || [];
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            equipment: [...equipment, { id: room.id, name: room.name, type: 'room' }]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            equipment: equipment.filter(eq => !(eq.id === room.id && eq.type === 'room'))
                          });
                        }
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{room.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          
          {/* 8. Google Meet連携設定 */}
          {type === 'general' && supportsMeetLink(formData.type || '') && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Video className="h-4 w-4 mr-2" />
                Google Meet
              </h4>
              
              {/* 会議形式選択 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">会議形式</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="meetingType"
                      value="in-person"
                      checked={formData.meetingType === 'in-person'}
                      onChange={(e) => handleMeetingTypeChange(e.target.value as 'in-person')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 flex items-center">
                      <UsersIcon className="h-4 w-4 mr-1" />
                      対面
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="meetingType"
                      value="online"
                      checked={formData.meetingType === 'online'}
                      onChange={(e) => handleMeetingTypeChange(e.target.value as 'online')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 flex items-center">
                      <Video className="h-4 w-4 mr-1" />
                      オンライン
                    </span>
                  </label>
                </div>
              </div>
              
              {/* Google Meet リンク設定 */}
              {formData.meetingType === 'online' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Google Meet リンク</label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={formData.meetLink || ''}
                      onChange={(e) => setFormData({ ...formData, meetLink: e.target.value })}
                      placeholder="自動生成されます（手動入力も可）"
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateMeetLink}
                      disabled={isGeneratingMeetLink}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Google Meet URLを生成します"
                    >
                      {isGeneratingMeetLink ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-1"></div>
                          生成中...
                        </>
                      ) : (
                        <>
                          <Video className="h-4 w-4 mr-1" />
                          自動生成
                        </>
                      )}
                    </button>
                  </div>
                  {formData.meetLink && !isValidMeetLink(formData.meetLink) && (
                    <p className="mt-1 text-sm text-red-600">有効なGoogle Meet URLを入力してください</p>
                  )}
                  {formData.meetLink && isValidMeetLink(formData.meetLink) && (
                    <div className="mt-2 flex items-center">
                      <Link className="h-4 w-4 text-green-600 mr-1" />
                      <a 
                        href={formData.meetLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-green-600 hover:text-green-800 underline"
                      >
                        会議に参加する
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* 10. 車両 - サンプル予約以外の場合のみ表示 */}
          {type !== 'sample' && (
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">車両</label>
              <div className="space-y-1">
                {availableVehicles.map(vehicle => (
                  <label key={vehicle.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={(formData.equipment || []).some(eq => eq.id === vehicle.id && eq.type === 'vehicle')}
                      onChange={(e) => {
                        const equipment = formData.equipment || [];
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            equipment: [...equipment, { id: vehicle.id, name: vehicle.name, type: 'vehicle' }]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            equipment: equipment.filter(eq => !(eq.id === vehicle.id && eq.type === 'vehicle'))
                          });
                        }
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{vehicle.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {/* サンプル設備 - サンプル予約の場合のみ表示 */}
          {type === 'sample' && (
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">サンプル設備</label>
              <div className="space-y-1">
                {availableSampleEquipment.map(equipment => (
                  <label key={equipment.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={(formData.equipment || []).some(eq => eq.id === equipment.id && eq.type === 'sample')}
                      onChange={(e) => {
                        const equipmentList = formData.equipment || [];
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            equipment: [...equipmentList, { id: equipment.id, name: equipment.name, type: 'sample' }]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            equipment: equipmentList.filter(eq => !(eq.id === equipment.id && eq.type === 'sample'))
                          });
                        }
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{equipment.name} ({equipment.type})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {/* 11. リマインダー設定 - サンプル予約以外の場合のみ表示 */}
          {type !== 'sample' && (
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">リマインダー通知</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-4">
                  <select
                    value={formData.reminders?.[0]?.time || 15}
                    onChange={(e) => {
                      const time = parseInt(e.target.value);
                      setFormData({
                        ...formData,
                        reminders: [{ time, methods: formData.reminders?.[0]?.methods || ['email'] }]
                      });
                    }}
                    className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value={5}>5分前</option>
                    <option value={10}>10分前</option>
                    <option value={15}>15分前</option>
                    <option value={30}>30分前</option>
                    <option value={60}>60分前</option>
                  </select>
                  
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.reminders?.[0]?.methods?.includes('email') || false}
                        onChange={(e) => {
                          const methods = formData.reminders?.[0]?.methods || [];
                          const newMethods = e.target.checked 
                            ? [...methods.filter(m => m !== 'email'), 'email']
                            : methods.filter(m => m !== 'email');
                          setFormData({
                            ...formData,
                            reminders: [{ time: formData.reminders?.[0]?.time || 15, methods: newMethods }]
                          });
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-1 text-sm text-gray-700">メール</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.reminders?.[0]?.methods?.includes('notification') || false}
                        onChange={(e) => {
                          const methods = formData.reminders?.[0]?.methods || [];
                          const newMethods = e.target.checked 
                            ? [...methods.filter(m => m !== 'notification'), 'notification']
                            : methods.filter(m => m !== 'notification');
                          setFormData({
                            ...formData,
                            reminders: [{ time: formData.reminders?.[0]?.time || 15, methods: newMethods }]
                          });
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-1 text-sm text-gray-700">プッシュ通知</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 12. 作成時メール送信オプション（サンプル予約以外） */}
          {type !== 'sample' && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <label className="block text-sm font-medium text-gray-700 mb-2">スケジュール作成時の通知</label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="sendEmailOnSave"
                  checked={sendEmailOnSave}
                  onChange={(e) => setSendEmailOnSave(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="sendEmailOnSave" className="text-sm text-gray-700">
                  {formData.meetLink ? 
                    'スケジュール作成時にGoogle Meet URLをメールで送信する' : 
                    'スケジュール作成時に参加者にメール通知を送信する'
                  }
                </label>
              </div>
              {formData.meetLink && (
                <p className="mt-1 text-xs text-gray-500">
                  ✨ Google Meet URLが設定されているため、専用のメールテンプレートで送信されます
                </p>
              )}
            </div>
          )}
          
          {/* 作成者・編集者情報 */}
          {editingSchedule && (
            <div className="border-t pt-4">
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                {creatorUser && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">作成者:</span>
                    <span className="text-gray-900">
                      {creatorUser.name} (ID: {creatorUser.employee_id})
                      {editingSchedule.createdAt && (
                        <span className="ml-2 text-gray-500">
                          {format(new Date(editingSchedule.createdAt), 'yyyy/MM/dd HH:mm')}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {updaterUser && editingSchedule.updatedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">最終編集:</span>
                    <span className="text-gray-900">
                      {updaterUser.name} (ID: {updaterUser.employee_id})
                      <span className="ml-2 text-gray-500">
                        {format(new Date(editingSchedule.updatedAt), 'yyyy/MM/dd HH:mm')}
                      </span>
                    </span>
                  </div>
                )}
                
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex space-x-2">
              {editingSchedule && (
                <>
                  {type === 'sample' && (
                    <>
                      {/* デバッグ用テストボタン */}
                      {process.env.NODE_ENV === 'development' && (
                        <button
                          type="button"
                          onClick={() => {
                            console.log('🧪 === テストボタンクリック ===');
                            console.log('現在の状態:');
                            console.log('  editingSchedule:', editingSchedule);
                            console.log('  formData:', formData);
                            console.log('  type:', type);
                            console.log('  productionNumber:', productionNumber);
                            console.log('  productCode:', productCode);
                            console.log('  quantity:', quantity);
                            console.log('  currentUser:', currentUser);
                            
                            // テスト用のコピーデータを作成
                            const testCopyData = {
                              type: 'サンプル作成',
                              title: 'テストサンプル1',
                              details: 'テスト用のコピー',
                              startTime: new Date(),
                              endTime: new Date(Date.now() + 3600000),
                              isCopy: true,
                              createdBy: currentUser?.id,
                              production_number: 'TEST-001',
                              product_code: 'TEST-PROD',
                              quantity: 1,
                              sample_number: 999,
                              equipment: formData.equipment
                            };
                            
                            console.log('テスト用コピーデータ:', testCopyData);
                            console.log('🚀 テストコピー実行...');
                            onSubmit(testCopyData);
                          }}
                          className="px-2 py-2 border border-purple-300 rounded-md shadow-sm text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100"
                          title="デバッグ用テストボタン"
                        >
                          🧪
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: 'スケジュールの削除',
                        message: 'このスケジュールを削除しますか？',
                        confirmText: '削除',
                        cancelText: 'キャンセル',
                        type: 'danger'
                      });
                      
                      if (confirmed) {
                        // 削除処理をonSubmitの特別なケースとして処理
                        onSubmit({ ...formData, _delete: true });
                        onClose();
                      }
                    }}
                    className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    削除
                  </button>
                </>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {editingSchedule ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </form>
        
        {/* 重複確認モーダル */}
        <ConfirmationModal
          isOpen={showConflictModal}
          onClose={() => setShowConflictModal(false)}
          onConfirm={handleForceSubmit}
          title="スケジュールの重複"
          message={`以下のスケジュールと重複しています：\n\n${conflictingSchedules.map(schedule => {
            const startTime = schedule.startTime || schedule.start_time;
            const endTime = schedule.endTime || schedule.end_time;
            const startDate = startTime ? new Date(startTime) : null;
            const endDate = endTime ? new Date(endTime) : null;
            
            if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              return `${schedule.title} (時刻情報が無効)`;
            }
            
            return `${schedule.title} (${format(startDate, 'MM/dd HH:mm')} - ${format(endDate, 'HH:mm')})`;
          }).join('\n')}\n\n続行しますか？`}
          confirmText="重複しても作成"
          cancelText="キャンセル"
          type="warning"
        />
        
        
        {/* コピー先日付選択モーダル */}
        {showCopyModal && (
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
                  onChange={async (e) => {
                    const targetDate = e.target.value;
                    setCopyTargetDate(targetDate);
                    
                    // コピー先日付のサンプル予約数を取得して連番を計算
                    if (targetDate) {
                      try {
                        const { data, error } = await supabase
                          .from('schedules')
                          .select('order_number, equipment, type')
                          .gte('start_time', `${targetDate}T00:00:00`)
                          .lte('start_time', `${targetDate}T23:59:59`)
                          .order('order_number', { ascending: false });
                        
                        if (!error && data) {
                          // 現在選択されている設備と同じ設備の予約をフィルタリング
                          const sameEquipmentSchedules = data.filter(schedule => {
                            if (!schedule.equipment || !formData.equipment) return false;
                            return schedule.equipment.some((eq: any) => 
                              formData.equipment?.some((targetEq: any) => 
                                eq.id === targetEq.id && eq.type === targetEq.type
                              )
                            );
                          });
                          
                          // 最大のorder_number + 1 を次の番号とする
                          const maxOrderNumber = sameEquipmentSchedules.length > 0
                            ? Math.max(...sameEquipmentSchedules.map(s => s.order_number || 0))
                            : 0;
                          setNextSampleNumber(maxOrderNumber + 1);
                        } else {
                          setNextSampleNumber(1);
                        }
                      } catch (err) {
                        console.error('Error fetching sample schedules:', err);
                        setNextSampleNumber(1);
                      }
                    }
                  }}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              
              {copyTargetDate && (
                <div className="mb-4 p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">
                    コピー先日付: {format(new Date(copyTargetDate + 'T00:00:00'), 'yyyy年M月d日', { locale: ja })}
                  </p>
                  {type === 'sample' && (
                    <p className="text-sm text-blue-800 mt-1">
                      サンプル番号: {nextSampleNumber}
                    </p>
                  )}
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
                    console.log('✅ === コピー処理開始 ===');
                    
                    if (!copyTargetDate) {
                      alert('コピー先の日付を選択してください');
                      return;
                    }
                    
                    try {
                      // テスト: 現在の状態を確認
                      console.log('🔍 現在の状態:');
                      console.log('  - editingSchedule:', editingSchedule);
                      console.log('  - formData.title:', formData.title);
                      console.log('  - copyTargetDate:', copyTargetDate);
                      console.log('  - nextSampleNumber:', nextSampleNumber);
                      console.log('  - currentUser:', currentUser);
                      console.log('  - productionNumber:', productionNumber);
                      console.log('  - productCode:', productCode);
                      console.log('  - quantity:', quantity);
                      
                      // コピーデータを作成
                      const timeDiff = formData.endTime.getTime() - formData.startTime.getTime();
                      const newStartTime = new Date(copyTargetDate);
                      newStartTime.setHours(formData.startTime.getHours(), formData.startTime.getMinutes(), 0, 0);
                      const newEndTime = new Date(newStartTime.getTime() + timeDiff);
                      
                      const copyData = {
                        // formDataから必要な項目をコピー（日付は新しい日付に変更）
                        type: formData.type || '会議',
                        title: formData.title || '',
                        details: formData.details || '',
                        location: formData.location || '',
                        description: formData.description || '',
                        startTime: newStartTime,
                        endTime: newEndTime,
                        start_time: newStartTime.toISOString(), // DBフィールド用
                        end_time: newEndTime.toISOString(), // DBフィールド用
                        isAllDay: formData.isAllDay || false,
                        isMultiDay: formData.isMultiDay || false,
                        participants: formData.participants || [],
                        equipment: formData.equipment || [],
                        meetingType: formData.meetingType || 'in-person',
                        meetLink: '', // 新規作成時は空
                        isCopy: true, // コピーフラグを追加
                        createdBy: currentUser?.id,
                        notes: formData.notes || ''
                      };
                      
                      // サンプル予約の場合のみ追加フィールドを設定
                      if (type === 'sample') {
                        copyData.type = 'サンプル作成';
                        copyData.title = formData.title ? formData.title.replace(/サンプル\d+/, `サンプル${nextSampleNumber}`) : `サンプル${nextSampleNumber}`;
                        copyData.production_number = productionNumber;
                        copyData.product_code = productCode;
                        copyData.quantity = quantity === '' ? undefined : quantity;
                        copyData.assigned_to = currentUser?.id || assignedTo || undefined;
                        copyData.sample_number = nextSampleNumber;
                      }
                      
                      console.log('📦 作成したコピーデータ:', copyData);
                      
                      // テスト: コピーデータの検証
                      const validationErrors = [];
                      if (!copyData.title) validationErrors.push('タイトルがありません');
                      if (!copyData.startTime) validationErrors.push('開始時刻がありません');
                      if (!copyData.endTime) validationErrors.push('終了時刻がありません');
                      
                      // サンプル予約の場合のみのバリデーション
                      if (type === 'sample') {
                        if (!copyData.production_number) validationErrors.push('生産番号がありません');
                        if (!copyData.product_code) validationErrors.push('品番がありません');
                      }
                      
                      if (validationErrors.length > 0) {
                        console.error('❌ バリデーションエラー:', validationErrors);
                        alert('コピーデータに問題があります:\n' + validationErrors.join('\n'));
                        return;
                      }
                      
                      console.log('✅ バリデーションOK');
                      
                      // コピーモーダルを閉じる
                      setShowCopyModal(false);
                      
                      // テスト: onSubmit呼び出し前
                      console.log('🚀 onSubmitを呼び出します...');
                      console.log('  送信データ詳細:');
                      console.log('    startTime:', copyData.startTime);
                      console.log('    endTime:', copyData.endTime);
                      console.log('    title:', copyData.title);
                      console.log('    sample_number:', copyData.sample_number);
                      
                      // コピー処理を実行
                      console.log('📞 onSubmit関数の確認:', typeof onSubmit, onSubmit);
                      
                      if (typeof onSubmit === 'function') {
                        console.log('✅ onSubmitは関数です。実行します...');
                        try {
                          // 非同期関数の可能性があるのでPromiseとして扱う
                          const result = onSubmit(copyData);
                          if (result && typeof result.then === 'function') {
                            console.log('⏳ onSubmitはPromiseを返しました。待機します...');
                            await result;
                            console.log('✅ Promise解決');
                          }
                        } catch (submitError) {
                          console.error('❌ onSubmit実行エラー:', submitError);
                          throw submitError;
                        }
                      } else {
                        console.error('❌ onSubmitが関数ではありません！');
                      }
                      
                      console.log('✅ onSubmit呼び出し完了');
                      console.log('✅ === コピー処理完了 ===');
                      
                      // 元のモーダルも閉じる
                      onClose();
                      
                    } catch (error) {
                      console.error('❌ コピーエラー:', error);
                      alert('コピー処理中にエラーが発生しました: ' + error.message);
                    }
                  }}
                  disabled={!copyTargetDate}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  コピー実行
                </button>
              </div>
            </div>
          </div>
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
    </div>
  );
}