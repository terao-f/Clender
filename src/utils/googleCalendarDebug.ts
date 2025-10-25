// Googleカレンダー連携のデバッグ用ユーティリティ

export class GoogleCalendarDebugger {
  /**
   * 現在のトークン状態を確認
   */
  static async checkTokenStatus() {
    console.log('=== Google Calendar Token Status ===');
    
    // ローカルストレージの確認
    const localTokens = localStorage.getItem('google_tokens');
    console.log('Local Storage Tokens:', localTokens ? 'EXISTS' : 'NOT FOUND');
    
    if (localTokens) {
      try {
        const tokens = JSON.parse(localTokens);
        console.log('Token Details:', {
          hasAccessToken: !!tokens.accessToken,
          hasRefreshToken: !!tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          isExpired: new Date(tokens.expiresAt) <= new Date()
        });
      } catch (error) {
        console.error('Failed to parse local tokens:', error);
      }
    }
    
    // データベースの確認
    try {
      const { supabase } = await import('../lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from('user_google_tokens')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        console.log('Database Tokens:', data ? 'EXISTS' : 'NOT FOUND');
        if (data) {
          console.log('Database Token Details:', {
            hasAccessToken: !!data.access_token,
            hasRefreshToken: !!data.refresh_token,
            expiresAt: data.expires_at,
            isExpired: new Date(data.expires_at) <= new Date()
          });
        }
        if (error) {
          console.error('Database Error:', error);
        }
      } else {
        console.log('No authenticated user found');
      }
    } catch (error) {
      console.error('Failed to check database:', error);
    }
    
    console.log('=====================================');
  }
  
  /**
   * トークンを強制的に期限切れにする（テスト用）
   */
  static forceTokenExpiration() {
    console.log('=== Forcing Token Expiration ===');
    
    const localTokens = localStorage.getItem('google_tokens');
    if (localTokens) {
      try {
        const tokens = JSON.parse(localTokens);
        tokens.expiresAt = new Date(Date.now() - 1000).toISOString(); // 1秒前に期限切れ
        localStorage.setItem('google_tokens', JSON.stringify(tokens));
        console.log('Local tokens expired');
      } catch (error) {
        console.error('Failed to expire local tokens:', error);
      }
    }
    
    console.log('=====================================');
  }
  
  /**
   * 無効なリフレッシュトークンを設定（テスト用）
   */
  static setInvalidRefreshToken() {
    console.log('=== Setting Invalid Refresh Token ===');
    
    const localTokens = localStorage.getItem('google_tokens');
    if (localTokens) {
      try {
        const tokens = JSON.parse(localTokens);
        tokens.refreshToken = 'invalid_refresh_token_for_testing';
        tokens.expiresAt = new Date(Date.now() - 1000).toISOString();
        localStorage.setItem('google_tokens', JSON.stringify(tokens));
        console.log('Invalid refresh token set');
      } catch (error) {
        console.error('Failed to set invalid refresh token:', error);
      }
    }
    
    console.log('=====================================');
  }
  
  /**
   * 全トークンをクリア
   */
  static clearAllTokens() {
    console.log('=== Clearing All Tokens ===');
    
    // ローカルストレージをクリア
    localStorage.removeItem('google_tokens');
    localStorage.removeItem('google_auth_state');
    
    console.log('All tokens cleared');
    console.log('=====================================');
  }
  
  /**
   * トークンリフレッシュをテスト
   */
  static async testTokenRefresh() {
    console.log('=== Testing Token Refresh ===');
    
    try {
      const { googleAuthService } = await import('../services/googleAuthService');
      const result = await googleAuthService.refreshTokens();
      
      if (result) {
        console.log('Token refresh successful:', {
          hasAccessToken: !!result.accessToken,
          hasRefreshToken: !!result.refreshToken,
          expiresAt: result.expiresAt
        });
      } else {
        console.log('Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh test error:', error);
    }
    
    console.log('=====================================');
  }
  
  /**
   * 有効なアクセストークンを取得テスト
   */
  static async testGetValidAccessToken() {
    console.log('=== Testing Get Valid Access Token ===');
    
    try {
      const { googleAuthService } = await import('../services/googleAuthService');
      const token = await googleAuthService.getValidAccessToken();
      
      if (token) {
        console.log('Valid access token obtained:', token.substring(0, 20) + '...');
      } else {
        console.log('No valid access token available');
      }
    } catch (error) {
      console.error('Get valid access token test error:', error);
    }
    
    console.log('=====================================');
  }
  
  /**
   * Google認証URLを生成テスト
   */
  static async testAuthUrlGeneration() {
    console.log('=== Testing Auth URL Generation ===');
    
    try {
      const { googleAuthService } = await import('../services/googleAuthService');
      const authUrl = googleAuthService.getAuthUrl(true);
      console.log('Auth URL generated:', authUrl);
    } catch (error) {
      console.error('Auth URL generation test error:', error);
    }
    
    console.log('=====================================');
  }
}

// グローバルにデバッガーを公開（開発環境のみ）
if (import.meta.env.DEV) {
  (window as any).GoogleCalendarDebugger = GoogleCalendarDebugger;
  console.log('GoogleCalendarDebugger available at window.GoogleCalendarDebugger');
}
