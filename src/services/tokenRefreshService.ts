// トークンリフレッシュサービス
import { supabase } from '../lib/supabase';

export class TokenRefreshService {
  
  /**
   * アプリ起動時にトークンの状態をチェックし、必要に応じてリフレッシュ
   */
  static async checkAndRefreshTokensOnStartup(userId: string): Promise<boolean> {
    try {
      console.log('🔄 アプリ起動時トークンチェック開始:', userId);
      
      // トークンの有効期限をチェック
      const tokenStatus = await this.checkTokenExpiry(userId);
      
      if (!tokenStatus.isValid) {
        console.log('⚠️ トークンが無効または期限切れのため、リフレッシュを試行');
        const refreshResult = await this.manualRefreshTokens(userId);
        return refreshResult.success;
      }
      
      console.log('✅ トークンは有効です');
      return true;

    } catch (error) {
      console.error('❌ トークンチェックエラー:', error);
      return false;
    }
  }

  /**
   * 手動でトークンをリフレッシュ
   */
  static async manualRefreshTokens(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 手動トークンリフレッシュ開始:', userId);
      
      // 既存のgoogleAuthServiceを使用してトークンをリフレッシュ
      const { googleAuthService } = await import('./googleAuthService');
      const newTokens = await googleAuthService.refreshTokens();

      if (!newTokens) {
        console.error('❌ 手動トークンリフレッシュエラー: トークンが取得できませんでした');
        return { 
          success: false, 
          message: 'トークンリフレッシュに失敗しました。再認証が必要です。' 
        };
      }

      console.log('✅ 手動トークンリフレッシュ完了');
      return { 
        success: true, 
        message: 'トークンリフレッシュが完了しました' 
      };

    } catch (error: any) {
      console.error('❌ 手動トークンリフレッシュエラー:', error);
      
      // エラーの種類に応じて適切なメッセージを返す
      let errorMessage = 'トークンリフレッシュに失敗しました';
      if (error.message?.includes('invalid_grant') || error.message?.includes('invalid_request')) {
        errorMessage = '認証が期限切れです。再認証が必要です。';
      } else if (error.message) {
        errorMessage = `トークンリフレッシュに失敗しました: ${error.message}`;
      }
      
      return { 
        success: false, 
        message: errorMessage
      };
    }
  }

  /**
   * トークンの有効期限をチェック
   */
  static async checkTokenExpiry(userId: string): Promise<{ isValid: boolean; expiresAt?: Date; timeUntilExpiry?: number }> {
    try {
      const { data, error } = await supabase
        .from('user_google_tokens')
        .select('expires_at')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return { isValid: false };
      }

      const expiresAt = new Date(data.expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();

      return {
        isValid: timeUntilExpiry > 0,
        expiresAt,
        timeUntilExpiry
      };

    } catch (error) {
      console.error('❌ トークン有効期限チェックエラー:', error);
      return { isValid: false };
    }
  }

  /**
   * バックグラウンドでのトークンリフレッシュ状態を確認
   */
  static async getRefreshStatus(): Promise<{ isActive: boolean; lastRefresh?: Date }> {
    try {
      // 現在はフロントエンド側のリフレッシュのみなので、常にアクティブとみなす
      // 将来的にバックグラウンドリフレッシュが実装されたら、ログテーブルを参照
      return { 
        isActive: true, 
        lastRefresh: new Date() // 現在時刻を返す
      };

    } catch (error) {
      console.error('❌ リフレッシュ状態チェックエラー:', error);
      return { isActive: false };
    }
  }
}

export const tokenRefreshService = TokenRefreshService;
