// Google Calendar API エラーハンドラー
export interface GoogleApiError {
  code: number;
  message: string;
  userMessage: string;
  retryable: boolean;
  retryDelay?: number;
}

/**
 * Google Calendar APIエラーを解析してユーザー向けメッセージを生成
 */
export function parseGoogleApiError(error: any): GoogleApiError {
  const defaultError: GoogleApiError = {
    code: 500,
    message: 'Unknown error',
    userMessage: '不明なエラーが発生しました',
    retryable: false
  };

  try {
    // エラーオブジェクトの構造を確認
    let errorData: any = error;
    
    if (error.message) {
      try {
        // JSON形式のエラーメッセージをパース
        const jsonMatch = error.message.match(/\{.*\}/);
        if (jsonMatch) {
          errorData = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        // JSONパースに失敗した場合はそのまま処理
      }
    }

    // Google APIエラーレスポンスの構造に対応
    const apiError = errorData.error || errorData;
    const errorCode = apiError.code || error.status || 500;
    const errorMessage = apiError.message || error.message || 'Unknown error';

    // エラーコードに応じた処理
    switch (errorCode) {
      case 403:
        if (errorMessage.includes('quotaExceeded') || errorMessage.includes('usage limits exceeded')) {
          return {
            code: 403,
            message: errorMessage,
            userMessage: 'Google Calendar APIの利用制限に達しました。しばらく待ってから再試行してください。',
            retryable: true,
            retryDelay: 2 * 60 * 1000 // 2分後
          };
        } else if (errorMessage.includes('rateLimitExceeded')) {
          return {
            code: 403,
            message: errorMessage,
            userMessage: 'リクエストが多すぎます。少し待ってから再試行してください。',
            retryable: true,
            retryDelay: 60 * 1000 // 1分後
          };
        } else {
          return {
            code: 403,
            message: errorMessage,
            userMessage: 'Google Calendarへのアクセス権限がありません。設定を確認してください。',
            retryable: false
          };
        }

      case 429:
        return {
          code: 429,
          message: errorMessage,
          userMessage: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
          retryable: true,
          retryDelay: 1 * 60 * 1000 // 1分後
        };

      case 401:
        return {
          code: 401,
          message: errorMessage,
          userMessage: 'Google認証の有効期限が切れています。再度ログインしてください。',
          retryable: false
        };

      case 404:
        return {
          code: 404,
          message: errorMessage,
          userMessage: '指定されたカレンダーまたはイベントが見つかりません。',
          retryable: false
        };

      case 400:
        return {
          code: 400,
          message: errorMessage,
          userMessage: 'リクエストの内容に問題があります。予定の内容を確認してください。',
          retryable: false
        };

      default:
        if (errorCode >= 500) {
          return {
            code: errorCode,
            message: errorMessage,
            userMessage: 'Google Calendarサービスで一時的な問題が発生しています。しばらく待ってから再試行してください。',
            retryable: true,
            retryDelay: 5 * 60 * 1000 // 5分後
          };
        } else {
          return {
            code: errorCode,
            message: errorMessage,
            userMessage: `Google Calendar連携でエラーが発生しました: ${errorMessage}`,
            retryable: false
          };
        }
    }
  } catch (parseError) {
    console.error('エラー解析に失敗:', parseError);
    return defaultError;
  }
}

/**
 * エラーレベルを判定
 */
export function getErrorLevel(error: GoogleApiError): 'info' | 'warning' | 'error' | 'critical' {
  if (error.code === 403 && error.message.includes('quotaExceeded')) {
    return 'warning'; // API制限は警告レベル
  }
  
  if (error.code === 429) {
    return 'warning'; // レート制限は警告レベル
  }
  
  if (error.code === 401) {
    return 'error'; // 認証エラーはエラーレベル
  }
  
  if (error.code >= 500) {
    return 'critical'; // サーバーエラーは重要レベル
  }
  
  return 'error'; // その他はエラーレベル
}

/**
 * ユーザー向けの推奨アクションを取得
 */
export function getRecommendedAction(error: GoogleApiError): string {
  switch (error.code) {
    case 403:
      if (error.message.includes('quotaExceeded')) {
        return '同期頻度を下げるか、しばらく時間をおいてから再試行してください。';
      }
      return 'Google Calendar連携の設定を確認してください。';
      
    case 429:
      return '少し待ってから再試行するか、同期頻度を下げてください。';
      
    case 401:
      return '設定 > カレンダー連携からGoogle認証をやり直してください。';
      
    case 404:
      return 'カレンダーの設定を確認してください。';
      
    case 400:
      return '予定の内容（日時、タイトルなど）を確認してください。';
      
    default:
      if (error.retryable) {
        return 'しばらく待ってから再試行してください。';
      }
      return 'サポートにお問い合わせください。';
  }
}
