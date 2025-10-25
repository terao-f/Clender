// スケジュールの色設定を統一管理するユーティリティ

export interface ScheduleColorStyles {
  bgColor: string;
  textColor: string;
  borderColor: string;
  hoverBg: string;
}

/**
 * スケジュールタイプに基づいて色スタイルを取得する関数
 * マイ・会議室・車両カレンダー共通で使用
 */
export const getScheduleTypeStyles = (type: string, isFromGoogleCalendar?: boolean): ScheduleColorStyles => {
  // Googleカレンダーからの入力の場合は「iPhone」種別として処理
  // 色は「iPhone」ケースで設定される

  switch (type) {
    // 会議系
    case '会議':
      return {
        bgColor: 'bg-blue-100', // 薄い青
        textColor: 'text-blue-800',
        borderColor: 'border-blue-500',
        hoverBg: 'hover:bg-blue-200'
      };
    
    // 商談系
    case 'オンライン商談':
      return {
        bgColor: 'bg-purple-100', // 薄い紫
        textColor: 'text-purple-800',
        borderColor: 'border-purple-500',
        hoverBg: 'hover:bg-purple-200'
      };
    
    case '15分無料相談':
      return {
        bgColor: 'bg-green-100', // 薄い緑
        textColor: 'text-green-800',
        borderColor: 'border-green-500',
        hoverBg: 'hover:bg-green-200'
      };
    
    // 来訪・面接系
    case '来訪':
      return {
        bgColor: 'bg-amber-200', // 濃いベージュ
        textColor: 'text-amber-900',
        borderColor: 'border-amber-600',
        hoverBg: 'hover:bg-amber-300'
      };
    
    case '面接':
      return {
        bgColor: 'bg-amber-100', // 薄いベージュ
        textColor: 'text-amber-800',
        borderColor: 'border-amber-500',
        hoverBg: 'hover:bg-amber-200'
      };
    
    // 工事・外出系
    case '工事':
      return {
        bgColor: 'bg-white', // 白
        textColor: 'text-gray-800',
        borderColor: 'border-gray-300',
        hoverBg: 'hover:bg-gray-50'
      };
    
    case '外出':
    case '出張':
      return {
        bgColor: 'bg-orange-100', // オレンジ
        textColor: 'text-orange-800',
        borderColor: 'border-orange-500',
        hoverBg: 'hover:bg-orange-200'
      };
    
    // iPhone（Googleカレンダーからの予定）
    case 'iPhone':
      return {
        bgColor: 'bg-pink-200', // ピンク
        textColor: 'text-pink-900',
        borderColor: 'border-pink-400',
        hoverBg: 'hover:bg-pink-300'
      };
    
    // その他
    default:
      return {
        bgColor: 'bg-white', // 白
        textColor: 'text-gray-800',
        borderColor: 'border-gray-300',
        hoverBg: 'hover:bg-gray-50'
      };
  }
};

/**
 * 特別なスケジュール（繰り返し・複数日・終日・非公開）の色スタイルを取得する関数
 * 種別色より優先される
 */
export const getSpecialScheduleStyles = (schedule: any): ScheduleColorStyles | null => {
  // 非公開スケジュール（最優先）
  if (schedule.isPrivate || schedule.is_private) {
    return {
      bgColor: 'bg-red-100', // 薄い赤色
      textColor: 'text-red-800',
      borderColor: 'border-red-400',
      hoverBg: 'hover:bg-red-200'
    };
  }
  
  // 繰り返し予定の判定を強化
  const isRecurring = (
    // original_idが設定されている（繰り返しのインスタンス）
    (schedule.original_id && schedule.original_id !== null) ||
    // IDにアンダースコアが含まれている（動的に生成されたインスタンスID）
    (schedule.id && schedule.id.includes('_') && schedule.id.length > 36)
  );
  
  // 繰り返し予約の元の予定（original_idがnullでrecurrenceが設定されている）も灰色で表示
  const isRecurringOriginal = (
    !schedule.original_id && 
    schedule.recurrence && 
    schedule.recurrence.frequency && 
    schedule.recurrence.frequency !== 'none'
  );
  
  // 繰り返し予約（初日も含む）は全て灰色で表示
  if (isRecurring || isRecurringOriginal) {
    return {
      bgColor: 'bg-gray-100', // 薄い灰色
      textColor: 'text-gray-700',
      borderColor: 'border-gray-400',
      hoverBg: 'hover:bg-gray-200'
    };
  }
  
  // 複数日予定
  if (schedule.isMultiDay || schedule.is_multi_day || 
      (schedule.startTime && schedule.endTime && 
       new Date(schedule.startTime).toDateString() !== new Date(schedule.endTime).toDateString())) {
    return {
      bgColor: 'bg-gray-100', // 薄い灰色
      textColor: 'text-gray-700',
      borderColor: 'border-gray-400',
      hoverBg: 'hover:bg-gray-200'
    };
  }
  
  // 終日予定
  if (schedule.isAllDay || schedule.is_all_day) {
    return {
      bgColor: 'bg-gray-100', // 薄い灰色
      textColor: 'text-gray-700',
      borderColor: 'border-gray-400',
      hoverBg: 'hover:bg-gray-200'
    };
  }
  
  return null; // 特別なスケジュールでない場合はnullを返す
};

/**
 * スケジュールの最終的な色スタイルを取得する関数
 * 特別なスケジュール（繰り返し・複数日・終日）を優先し、それ以外は種別色を使用
 */
export const getFinalScheduleStyles = (schedule: any): ScheduleColorStyles => {
  // まず特別なスケジュールかチェック
  const specialStyles = getSpecialScheduleStyles(schedule);
  if (specialStyles) {
    return specialStyles;
  }
  
  // 特別でない場合は種別色を使用
  // 種別が「iPhone」でない場合は、Googleカレンダーフラグを無視
  const isGoogleCalendar = schedule.type === 'iPhone' && (schedule.isFromGoogleCalendar || schedule.is_from_google_calendar);
  const typeStyles = getScheduleTypeStyles(schedule.type || '', isGoogleCalendar);
  return typeStyles;
};
