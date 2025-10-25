/**
 * Google OAuth認証サービス
 * Googleカレンダーとの連携のための認証処理
 */

import { supabase } from '../lib/supabase';

export interface GoogleAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class GoogleAuthService {
  private clientId: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  private redirectUri: string = '';
  private scope: string = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.events.owned',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' ');

  /**
   * リダイレクトURIを動的に生成
   */
  private getRedirectUri(): string {
    // 開発環境では現在のポートを動的に使用
    const origin = window.location.origin;
    const redirectUri = `${origin}/auth/google/callback`;
    console.log('🌍 Using dynamic redirect URI:', redirectUri);
    return redirectUri;
  }
  
  /**
   * Google OAuth認証URLを生成
   */
  getAuthUrl(forceAccountSelection: boolean = false): string {
    // リダイレクトURIを動的に取得
    this.redirectUri = this.getRedirectUri();
    
    // デバッグ用：実際のリダイレクトURIをログ出力
    console.log('🌐 Google OAuth Configuration:');
    console.log('  Redirect URI:', this.redirectUri);
    console.log('  Current origin:', window.location.origin);
    console.log('  Client ID:', this.clientId ? this.clientId.substring(0, 20) + '...' : 'NOT SET');
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scope,
      access_type: 'offline',
      prompt: forceAccountSelection ? 'select_account consent' : 'consent',
      // 強制的にアカウント選択を表示するために追加のパラメータ
      include_granted_scopes: 'false',
      // 一意性を保つためのstateパラメータ
      state: `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * 認証コードをトークンに交換
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleAuthTokens | null> {
    console.log('exchangeCodeForTokens called with code:', code);
    try {
      // リダイレクトURIを再度取得（一致させるため）
      this.redirectUri = this.getRedirectUri();
      
      console.log('=== Token Exchange Debug ===');
      console.log('Code:', code);
      console.log('Redirect URI:', this.redirectUri);
      console.log('Client ID:', this.clientId ? this.clientId.substring(0, 20) + '...' : 'NOT SET');
      
      // Supabase Edge Functionを呼び出す
      console.log('Calling Supabase Edge Function...');
      const { data, error } = await supabase.functions.invoke('google-auth-callback', {
        body: {
          code,
          redirectUri: this.redirectUri
        }
      });

      console.log('Edge Function response:', { data, error });
      console.log('Token response:', data);

      if (error) {
        console.error('トークン交換エラー:', error);
        console.error('エラー詳細:', JSON.stringify(error, null, 2));
        return null;
      }

      if (!data || !data.access_token) {
        console.error('トークン交換エラー: 無効なレスポンス');
        return null;
      }

      // トークンをローカルストレージに保存
      console.log('Token data from Edge Function:', data);
      
      // expires_inのデフォルト値を設定（通常は3600秒 = 1時間）
      const expiresIn = data.expires_in || 3600;
      const expiresAt = data.expires_at 
        ? new Date(data.expires_at) 
        : new Date(Date.now() + expiresIn * 1000);
      
      const tokens: GoogleAuthTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: expiresAt,
        scope: data.scope || ''
      };

      await this.saveTokens(tokens);
      console.log('Tokens saved successfully');
      
      // データベースにも保存（統一化）
      try {
        const { saveUserGoogleTokens } = await import('../lib/googleCalendar');
        await saveUserGoogleTokens(
          this.getCurrentUserId(),
          tokens.accessToken,
          tokens.refreshToken,
          tokens.expiresAt,
          tokens.scope
        );
        console.log('Tokens also saved to database');
      } catch (dbError) {
        console.error('Failed to save tokens to database:', dbError);
        // データベース保存に失敗してもローカルストレージは成功しているので続行
      }
      
      return tokens;
    } catch (error) {
      console.error('トークン交換エラー:', error);
      return null;
    }
  }

  /**
   * トークンを保存
   */
  async saveTokens(tokens: GoogleAuthTokens, userId?: string): Promise<void> {
    // ユーザーIDを取得（引数で渡されるか、ローカルストレージから取得）
    const userIdToUse = userId || this.getCurrentUserId();
    
    if (!userIdToUse) {
      console.error('ユーザーIDが見つかりません');
      return;
    }

    // まず既存のトークンを削除
    await supabase
      .from('user_google_tokens')
      .delete()
      .eq('user_id', userIdToUse);

    // 新しいトークンを挿入
    const { error } = await supabase
      .from('user_google_tokens')
      .insert({
        user_id: userIdToUse,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt.toISOString(),
        scope: tokens.scope,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('トークン保存エラー:', error);
      if (error.code === '42501') {
        console.error('RLSポリシーエラー: user_google_tokensテーブルへのアクセス権限がありません。管理者に連絡してください。');
        throw new Error('Google認証情報の保存に失敗しました。データベースの権限設定を確認してください。');
      }
      throw error;
    }
  }
  
  /**
   * 現在のユーザーIDを取得
   */
  private getCurrentUserId(): string | null {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        return user.id;
      } catch (error) {
        console.error('ユーザー情報の解析エラー:', error);
      }
    }
    return null;
  }

  /**
   * 保存されたトークンを取得
   */
  async getStoredTokens(): Promise<GoogleAuthTokens | null> {
    try {
      const userId = this.getCurrentUserId();
      
      if (!userId) {
        return null;
      }

      const { data, error } = await supabase
        .from('user_google_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(data.expires_at),
        scope: data.scope
      };
    } catch (error) {
      console.error('トークン取得エラー:', error);
      return null;
    }
  }

  /**
   * トークンをリフレッシュ
   */
  async refreshTokens(): Promise<GoogleAuthTokens | null> {
    try {
      const currentTokens = await this.getStoredTokens();
      if (!currentTokens?.refreshToken) {
        console.error('No refresh token available');
        return null;
      }

      console.log('=== Token Refresh Debug ===');
      console.log('Refreshing token with refresh token:', currentTokens.refreshToken.substring(0, 20) + '...');

      const { data, error } = await supabase.functions.invoke('google-refresh-token', {
        body: {
          refreshToken: currentTokens.refreshToken
        }
      });

      if (error) {
        console.error('トークンリフレッシュエラー:', error);
        
        // リフレッシュトークンが無効な場合の処理
        if (error.message?.includes('invalid_grant') || error.message?.includes('invalid_request')) {
          console.log('Refresh token is invalid, clearing stored tokens');
          await this.clearTokens();
          
          // 認証期限切れイベントを発火
          window.dispatchEvent(new CustomEvent('google-auth-expired', { 
            detail: { 
              reason: 'refresh_token_invalid',
              message: 'Googleカレンダーの認証が期限切れです。再認証してください。'
            } 
          }));
        }
        
        return null;
      }

      const newTokens: GoogleAuthTokens = {
        accessToken: data.access_token,
        refreshToken: currentTokens.refreshToken, // リフレッシュトークンは変わらない
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        scope: data.scope || currentTokens.scope
      };

      await this.saveTokens(newTokens);
      
      // データベースにも保存
      try {
        const { saveUserGoogleTokens } = await import('../lib/googleCalendar');
        await saveUserGoogleTokens(
          this.getCurrentUserId(),
          newTokens.accessToken,
          newTokens.refreshToken,
          newTokens.expiresAt,
          newTokens.scope
        );
        console.log('Refreshed tokens also saved to database');
      } catch (dbError) {
        console.error('Failed to save refreshed tokens to database:', dbError);
      }
      
      console.log('Token refresh successful');
      return newTokens;
    } catch (error) {
      console.error('トークンリフレッシュエラー:', error);
      return null;
    }
  }

  /**
   * 有効なアクセストークンを取得（必要に応じてリフレッシュ）
   */
  async getValidAccessToken(): Promise<string | null> {
    const tokens = await this.getStoredTokens();
    if (!tokens) {
      // ローカルストレージにない場合はデータベースから取得を試行
      try {
        const { getValidAccessToken } = await import('../lib/googleCalendar');
        const userId = this.getCurrentUserId();
        if (userId) {
          return await getValidAccessToken(userId);
        }
      } catch (error) {
        console.error('Failed to get token from database:', error);
      }
      return null;
    }

    // トークンの有効期限をチェック
    const now = new Date();
    if (tokens.expiresAt > now) {
      return tokens.accessToken;
    }

    // トークンが期限切れの場合はリフレッシュ
    const newTokens = await this.refreshTokens();
    return newTokens?.accessToken || null;
  }

  /**
   * Googleユーザー情報を取得
   */
  async getUserInfo(): Promise<GoogleUserInfo | null> {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        return null;
      }

      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('ユーザー情報取得エラー');
      }

      const data = await response.json();
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture
      };
    } catch (error) {
      console.error('ユーザー情報取得エラー:', error);
      return null;
    }
  }

  /**
   * 認証状態をチェック
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getStoredTokens();
    return !!tokens;
  }

  /**
   * ログアウト（トークンを削除）
   */
  async logout(): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      
      if (!userId) {
        return;
      }

      const { error } = await supabase
        .from('user_google_tokens')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('トークン削除エラー:', error);
      }

      // 同期設定も削除
      await supabase
        .from('google_calendar_sync_settings')
        .delete()
        .eq('user_id', userId);

      // マッピングも削除
      await supabase
        .from('schedule_google_event_mappings')
        .delete()
        .eq('user_id', userId);

    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  }

  /**
   * 完全なアカウントリセット（別アカウントで再連携する場合）
   */
  async resetAccount(): Promise<void> {
    try {
      await this.logout();
      
      // ローカルストレージからもGoogle関連のデータを削除
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('google')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // セッションストレージも同様に削除
      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.includes('google')) {
          sessionKeysToRemove.push(key);
        }
      }
      
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
      
    } catch (error) {
      console.error('アカウントリセットエラー:', error);
    }
  }
}

export const googleAuthService = new GoogleAuthService();

// 追加のヘルパー関数
export interface GoogleAuthServiceExtended extends GoogleAuthService {
  checkConnectionStatus(userId: string): Promise<{ connected: boolean }>;
  disconnect(userId: string): Promise<boolean>;
  getSyncSettings(userId: string): Promise<any>;
  updateSyncSettings(userId: string, settings: any): Promise<boolean>;
}

// 拡張メソッドを追加
(googleAuthService as any).checkConnectionStatus = async function(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_google_tokens')
      .select('id, expires_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { connected: false };
      }
      throw error;
    }

    const isValid = data && new Date(data.expires_at) > new Date();
    return { connected: isValid };
  } catch (error) {
    console.error('Connection check error:', error);
    return { connected: false };
  }
};

(googleAuthService as any).disconnect = async function(userId: string) {
  try {
    const { error } = await supabase
      .from('user_google_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    // 同期設定も削除
    await supabase
      .from('google_calendar_sync_settings')
      .delete()
      .eq('user_id', userId);

    // マッピングも削除
    await supabase
      .from('schedule_google_event_mappings')
      .delete()
      .eq('user_id', userId);

    return true;
  } catch (error) {
    console.error('Disconnect error:', error);
    throw error;
  }
};

(googleAuthService as any).getSyncSettings = async function(userId: string) {
  try {
    const { data, error } = await supabase
      .from('google_calendar_sync_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 設定が存在しない場合はデフォルト値を返す
        return {
          enabled: false,
          sync_to_google: true,
          sync_from_google: false,
          google_calendar_id: 'primary'
        };
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Get sync settings error:', error);
    throw error;
  }
};

(googleAuthService as any).updateSyncSettings = async function(userId: string, settings: any) {
  try {
    const { error } = await supabase
      .from('google_calendar_sync_settings')
      .upsert({
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Update sync settings error:', error);
    throw error;
  }
};