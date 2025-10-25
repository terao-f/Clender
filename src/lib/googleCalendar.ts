import { supabase } from './supabase';
import { parseGoogleApiError, getErrorLevel } from '../utils/googleApiErrorHandler';

// Google Calendar APIのスコープ
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

// Google OAuth設定
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
export const GOOGLE_REDIRECT_URI = `${window.location.origin}/auth/google/callback`;

// Google認証URLを生成
export function getGoogleAuthUrl(userId: string, forceAccountSelection: boolean = false): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPES.join(' '),
    access_type: 'offline',
    prompt: forceAccountSelection ? 'consent select_account' : 'consent',
    state: userId, // ユーザーIDを state パラメータで渡す
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// アクセストークンを取得
export async function exchangeCodeForToken(code: string) {
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  return response.json();
}

// リフレッシュトークンを使用してアクセストークンを更新
export async function refreshAccessToken(refreshToken: string) {
  console.log('=== refreshAccessToken Debug ===');
  console.log('Refreshing token with refresh token:', refreshToken?.substring(0, 20) + '...');
  
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  console.log('Refresh token request params:', {
    hasRefreshToken: !!refreshToken,
    hasClientId: !!GOOGLE_CLIENT_ID,
    hasClientSecret: !!GOOGLE_CLIENT_SECRET
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  console.log('Refresh token response:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to refresh token:', error);
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  console.log('Token refreshed successfully, new token expires in:', data.expires_in);
  return data;
}

// ユーザーのGoogleトークンを保存
export async function saveUserGoogleTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
  scope?: string
) {
  console.log('=== saveUserGoogleTokens Debug ===');
  console.log('Saving tokens for userId:', userId);
  console.log('Token details:', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    expiresAt: expiresAt.toISOString(),
    scope: scope || GOOGLE_CALENDAR_SCOPES.join(' ')
  });

  try {
    const { error } = await supabase
      .from('user_google_tokens')
      .upsert({
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt.toISOString(),
        scope: scope || GOOGLE_CALENDAR_SCOPES.join(' ')
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Failed to save Google tokens:', error);
      throw new Error(`Failed to save Google tokens: ${error.message}`);
    }

    console.log('Tokens saved successfully');
  } catch (err) {
    console.error('Error in saveUserGoogleTokens:', err);
    throw err;
  }
}

// ユーザーのGoogleトークンを取得
export async function getUserGoogleTokens(userId: string) {
  try {
    console.log('=== getUserGoogleTokens Debug ===');
    console.log('Fetching tokens for userId:', userId);
    
    const { data, error } = await supabase
      .from('user_google_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    console.log('Token fetch result:', {
      hasData: !!data,
      error: error,
      dataKeys: data ? Object.keys(data) : null
    });

    if (error) {
      // 404エラー（データなし）、406エラー（RLS）、またはテーブルが存在しない場合
      if (error.code === 'PGRST116' || error.code === '406' || error.code === '42P01') {
        console.log('No Google tokens found or table access issue for user:', userId, 'Error code:', error.code);
        return null;
      }
      console.error('Failed to get Google tokens:', error);
      return null;
    }

    console.log('Token data retrieved successfully');
    return data;
  } catch (err) {
    console.error('Error accessing user_google_tokens:', err);
    return null;
  }
}

// ユーザーのGoogleトークンを削除
export async function deleteUserGoogleTokens(userId: string) {
  const { error } = await supabase
    .from('user_google_tokens')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete Google tokens: ${error.message}`);
  }
}

// 有効なアクセストークンを取得（必要に応じて更新）
export async function getValidAccessToken(userId: string): Promise<string | null> {
  console.log('=== getValidAccessToken Debug ===');
  console.log('Getting valid access token for userId:', userId);
  
  const tokens = await getUserGoogleTokens(userId);
  if (!tokens) {
    console.log('No tokens found for user');
    return null;
  }

  console.log('Token details:', {
    hasAccessToken: !!tokens.access_token,
    hasRefreshToken: !!tokens.refresh_token,
    expiresAt: tokens.expires_at,
    scope: tokens.scope
  });

  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();

  console.log('Token expiration check:', {
    expiresAt: expiresAt.toISOString(),
    now: now.toISOString(),
    isExpired: expiresAt <= new Date(now.getTime() + 30 * 60 * 1000)
  });

  // トークンが期限切れまたは30分以内に期限切れになる場合は更新（より余裕を持って更新）
  if (expiresAt <= new Date(now.getTime() + 30 * 60 * 1000)) {
    console.log('Token is expired or expiring soon, refreshing...');
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      
      console.log('Token refreshed successfully');
      
      await saveUserGoogleTokens(
        userId,
        newTokens.access_token,
        tokens.refresh_token, // リフレッシュトークンは変わらない
        newExpiresAt,
        tokens.scope || GOOGLE_CALENDAR_SCOPES.join(' ')
      );

      return newTokens.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      
      // リフレッシュトークンが無効な場合、トークンを削除して再認証を促す
      if (error.message.includes('invalid_grant') || error.message.includes('invalid_request') || 
          error.message.includes('unauthorized_client') || error.message.includes('unsupported_grant_type') ||
          error.message.includes('invalid_client') || error.message.includes('access_denied')) {
        console.log('Refresh token is invalid, deleting stored tokens');
        await deleteUserGoogleTokens(userId);
        
        // ユーザーに再認証を促すイベントを発火
        window.dispatchEvent(new CustomEvent('google-auth-expired', { 
          detail: { 
            userId, 
            reason: 'refresh_token_invalid',
            message: 'Googleカレンダーの認証が期限切れです。再認証してください。'
          } 
        }));
      }
      
      return null;
    }
  }

  console.log('Using existing valid token');
  return tokens.access_token;
}

// 定期的なトークン有効性チェック（改善版）
export function startTokenValidityCheck(userId: string, intervalMinutes: number = 10) {
  const checkInterval = intervalMinutes * 60 * 1000; // ミリ秒に変換
  
  const checkToken = async () => {
    try {
      console.log('🔄 トークン有効性チェック開始:', userId);
      
      // トークンを取得（自動リフレッシュも含む）
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        console.log('❌ トークン有効性チェック失敗: アクセストークンが取得できません');
        window.dispatchEvent(new CustomEvent('google-auth-expired', { 
          detail: { 
            userId, 
            reason: 'periodic_check_failed',
            message: 'Googleカレンダーの認証が期限切れです。再認証してください。'
          } 
        }));
        return;
      }

      // トークンの有効期限をチェック
      const tokens = await getUserGoogleTokens(userId);
      if (tokens && tokens.expiresAt) {
        const expiresAt = new Date(tokens.expiresAt);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        
        // 5分以内に期限切れの場合は事前にリフレッシュ
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          console.log('⚠️ トークンが5分以内に期限切れのため、事前リフレッシュを実行');
          try {
            // refreshAccessTokenはrefreshTokenを期待するため、tokensから取得
            const newTokens = await refreshAccessToken(tokens.refresh_token);
            const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
            
            // 新しいトークンを保存
            await saveUserGoogleTokens(
              userId,
              newTokens.access_token,
              tokens.refresh_token, // リフレッシュトークンは変わらない
              newExpiresAt,
              tokens.scope || GOOGLE_CALENDAR_SCOPES.join(' ')
            );
            
            console.log('✅ トークンの事前リフレッシュが完了');
          } catch (error) {
            console.error('❌ トークンの事前リフレッシュに失敗:', error);
            window.dispatchEvent(new CustomEvent('google-auth-expired', { 
              detail: { 
                userId, 
                reason: 'preemptive_refresh_failed',
                message: 'Googleカレンダーの認証リフレッシュに失敗しました。再認証してください。'
              } 
            }));
            return;
          }
        }
      }
      
      console.log('✅ トークン有効性チェック完了');
    } catch (error) {
      console.error('❌ トークン有効性チェックエラー:', error);
      // エラーが発生した場合も認証期限切れとして扱う
      window.dispatchEvent(new CustomEvent('google-auth-expired', { 
        detail: { 
          userId, 
          reason: 'check_error',
          message: 'Googleカレンダーの認証チェックでエラーが発生しました。再認証してください。'
        } 
      }));
    }
  };
  
  // 初回チェック
  checkToken();
  
  // 定期チェックを開始（デフォルト10分間隔）
  const intervalId = setInterval(checkToken, checkInterval);
  
  console.log(`🔄 トークン有効性チェックを開始しました（${intervalMinutes}分間隔）`);
  
  // クリーンアップ関数を返す
  return () => {
    clearInterval(intervalId);
    console.log('⏹️ トークン有効性チェックを停止しました');
  };
}

// Google Calendar APIクライアント
export class GoogleCalendarClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // カレンダーリストを取得
  async listCalendars() {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list calendars: ${response.statusText}`);
    }

    return response.json();
  }

  // イベントを作成（Google Meet対応 + レート制限対策）
  async createEvent(calendarId: string, event: any, includeConferenceData: boolean = false, retryCount: number = 0) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
    
    // Google Meetを含める場合は、conferenceDataVersionパラメータを追加
    if (includeConferenceData) {
      url.searchParams.append('conferenceDataVersion', '1');
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const error = await response.text();
        
        // レート制限エラーの場合はリトライ
        if (response.status === 403 || response.status === 429) {
          const maxRetries = 3;
          if (retryCount < maxRetries) {
            const apiError = parseGoogleApiError({ status: response.status, message: error });
            const delay = apiError.retryDelay || (Math.pow(2, retryCount) * 1000 + Math.random() * 1000);
            console.warn(`${apiError.userMessage} ${delay}ms後にリトライします (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.createEvent(calendarId, event, includeConferenceData, retryCount + 1);
          } else {
            const apiError = parseGoogleApiError({ status: response.status, message: error });
            console.error('最大リトライ回数に達しました:', apiError.userMessage);
            throw new Error(apiError.userMessage);
          }
        }
        
        throw new Error(`Failed to create event: ${error}`);
      }

      return response.json();
    } catch (fetchError) {
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.warn(`ネットワークエラー。${delay}ms後にリトライします`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.createEvent(calendarId, event, includeConferenceData, retryCount + 1);
      }
      throw fetchError;
    }
  }

  // イベントを更新（レート制限対策付き）
  async updateEvent(calendarId: string, eventId: string, event: any, retryCount: number = 0) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        
        // レート制限エラーの場合はリトライ
        if (response.status === 403 || response.status === 429) {
          const maxRetries = 3;
          if (retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
            console.warn(`API制限に達しました。${delay}ms後にリトライします (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.updateEvent(calendarId, eventId, event, retryCount + 1);
          } else {
            throw new Error('Google Calendar API制限に達しました。しばらく待ってから再試行してください。');
          }
        }
        
        throw new Error(`Failed to update event: ${error}`);
      }

      return response.json();
    } catch (fetchError) {
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.warn(`ネットワークエラー。${delay}ms後にリトライします`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.updateEvent(calendarId, eventId, event, retryCount + 1);
      }
      throw fetchError;
    }
  }

  // イベントを削除
  async deleteEvent(calendarId: string, eventId: string) {
    console.log('=== GoogleCalendarClient.deleteEvent Debug ===');
    console.log('Deleting event:', { calendarId, eventId });
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    console.log('Delete response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Delete error response:', error);
      throw new Error(`Failed to delete event: ${error}`);
    }

    console.log('✅ Event deleted successfully');
  }

  // イベントを取得
  async getEvent(calendarId: string, eventId: string) {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // イベントが見つからない場合
      }
      const error = await response.text();
      throw new Error(`Failed to get event: ${error}`);
    }

    return response.json();
  }

  // イベントリストを取得（レート制限対策付き）
  async listEvents(calendarId: string, timeMin?: Date, timeMax?: Date, retryCount: number = 0) {
    console.log('=== GoogleCalendarClient.listEvents Debug ===');
    console.log('Listing events with params:', {
      calendarId,
      timeMin: timeMin?.toISOString(),
      timeMax: timeMax?.toISOString(),
      retryCount
    });
    
    const params = new URLSearchParams({
      ...(timeMin && { timeMin: timeMin.toISOString() }),
      ...(timeMax && { timeMax: timeMax.toISOString() }),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`;
    console.log('API Request URL:', url);
    console.log('Authorization token length:', this.accessToken?.length || 0);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      console.log('API Response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        // レート制限エラーの場合はリトライ
        if (response.status === 403 || response.status === 429) {
          const maxRetries = 3;
          if (retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
            console.warn(`API制限に達しました。${delay}ms後にリトライします (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.listEvents(calendarId, timeMin, timeMax, retryCount + 1);
          } else {
            throw new Error('Google Calendar API制限に達しました。しばらく待ってから再試行してください。');
          }
        }
        
        throw new Error(`Failed to list events: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('API Response Data:', {
        hasItems: !!data.items,
        itemCount: data.items?.length || 0,
        kind: data.kind,
        etag: data.etag
      });

      return data;
    } catch (fetchError) {
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.warn(`ネットワークエラー。${delay}ms後にリトライします`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.listEvents(calendarId, timeMin, timeMax, retryCount + 1);
      }
      throw fetchError;
    }
  }
}