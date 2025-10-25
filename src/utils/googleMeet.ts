/**
 * Google Meet integration utilities
 */

export interface MeetingTypeConfig {
  allowsMeetLink: boolean;
  defaultType: 'in-person' | 'online' | 'hybrid';
  autoGenerateMeetLink: boolean;
}

// Configuration for different schedule types
export const MEETING_TYPE_CONFIG: Record<string, MeetingTypeConfig> = {
  // Online meeting types
  'オンライン商談': {
    allowsMeetLink: true,
    defaultType: 'online',
    autoGenerateMeetLink: true
  },
  '15分無料相談': {
    allowsMeetLink: true,
    defaultType: 'online',
    autoGenerateMeetLink: true
  },
  
  // Meeting types that can be online or in-person
  '会議': {
    allowsMeetLink: true,
    defaultType: 'hybrid',
    autoGenerateMeetLink: false
  },
  '打ち合わせ': {
    allowsMeetLink: true,
    defaultType: 'hybrid',
    autoGenerateMeetLink: false
  },
  '面接': {
    allowsMeetLink: true,
    defaultType: 'hybrid',
    autoGenerateMeetLink: false
  },
  '研修': {
    allowsMeetLink: true,
    defaultType: 'hybrid',
    autoGenerateMeetLink: false
  },
  'プレゼン': {
    allowsMeetLink: true,
    defaultType: 'hybrid',
    autoGenerateMeetLink: false
  },
  
  // In-person only types
  '来訪': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  '工事': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  
  // Vehicle related (in-person only)
  '外出': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  '営業': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  '配送': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  '出張': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  
  // Sample work (in-person only)
  'サンプル作成': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  'CAD・マーキング': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  'サンプル裁断': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  'サンプル縫製': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  'サンプル内職': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  'プレス': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  '仕上げ・梱包': {
    allowsMeetLink: false,
    defaultType: 'in-person',
    autoGenerateMeetLink: false
  },
  
  // Default for other types
  'その他': {
    allowsMeetLink: true,
    defaultType: 'hybrid',
    autoGenerateMeetLink: false
  }
};

/**
 * Generates a Google Meet link
 * In a real implementation, this would integrate with the Google Calendar API
 * For now, we'll generate a placeholder link with a unique meeting ID
 */
export function generateGoogleMeetLink(scheduleTitle: string, startTime: Date): string {
  // Generate a unique meeting ID based on title and time
  const meetingId = generateMeetingId(scheduleTitle, startTime);
  return `https://meet.google.com/${meetingId}`;
}

/**
 * Generates a unique meeting ID for the Meet link
 */
function generateMeetingId(title: string, startTime: Date): string {
  // Google Meet IDは通常、3つの部分に分かれた10文字のランダム文字列
  // 例: abc-defg-hij
  
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  
  // 各部分を生成
  const part1 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part3 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  return `${part1}-${part2}-${part3}`;
}

/**
 * Simple hash function for strings
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Gets the meeting type configuration for a schedule type
 */
export function getMeetingTypeConfig(scheduleType: string): MeetingTypeConfig {
  return MEETING_TYPE_CONFIG[scheduleType] || MEETING_TYPE_CONFIG['その他'];
}

/**
 * Determines if a schedule type supports Google Meet links
 */
export function supportsMeetLink(scheduleType: string): boolean {
  const config = getMeetingTypeConfig(scheduleType);
  return config.allowsMeetLink;
}

/**
 * Gets the default meeting type for a schedule type
 */
export function getDefaultMeetingType(scheduleType: string): 'in-person' | 'online' | 'hybrid' {
  const config = getMeetingTypeConfig(scheduleType);
  // hybridの場合はin-personをデフォルトとして返す
  if (config.defaultType === 'hybrid') {
    return 'in-person';
  }
  return config.defaultType;
}

/**
 * Determines if a Meet link should be auto-generated for a schedule type
 */
export function shouldAutoGenerateMeetLink(scheduleType: string): boolean {
  const config = getMeetingTypeConfig(scheduleType);
  return config.autoGenerateMeetLink;
}

/**
 * Validates a Google Meet link format
 */
export function isValidMeetLink(url: string): boolean {
  if (!url) return false;
  
  const meetPatterns = [
    // 標準的なGoogle Meet URL形式: https://meet.google.com/abc-defg-hij
    /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/,
    // 古い形式や特殊な形式も許可
    /^https:\/\/meet\.google\.com\/[a-z0-9\-]{10,}$/,
    // lookup形式
    /^https:\/\/meet\.google\.com\/lookup\/[a-z0-9]+$/,
    // その他のGoogle Meet形式
    /^https:\/\/meet\.google\.com\/[a-z0-9\-_]{3,}$/
  ];
  
  return meetPatterns.some(pattern => pattern.test(url));
}

/**
 * Gets the display text for meeting types
 */
export function getMeetingTypeDisplay(meetingType: 'in-person' | 'online' | 'hybrid'): string {
  switch (meetingType) {
    case 'in-person':
      return '対面';
    case 'online':
      return 'オンライン';
    case 'hybrid':
      return 'ハイブリッド';
    default:
      return '対面';
  }
}

/**
 * Gets the CSS classes for meeting type badges
 */
export function getMeetingTypeStyles(meetingType: 'in-person' | 'online' | 'hybrid'): string {
  switch (meetingType) {
    case 'in-person':
      return 'bg-gray-100 text-gray-800';
    case 'online':
      return 'bg-blue-100 text-blue-800';
    case 'hybrid':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}