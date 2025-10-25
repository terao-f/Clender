import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  refreshToken: string;
}

serve(async (req: Request) => {
  // CORSプリフライトリクエスト処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { refreshToken } = await req.json() as RequestBody;
    
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    // Google OAuth2 APIでトークンをリフレッシュ
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    console.log('Token refresh request:', {
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ? 'SET' : 'NOT SET',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ? 'SET' : 'NOT SET',
      refresh_token: refreshToken.substring(0, 20) + '...'
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    console.log('Token refresh response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('Google token refresh failed:', error);
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();
    
    // 新しいアクセストークンと有効期限を返す
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));

    return new Response(
      JSON.stringify({
        access_token: data.access_token,
        expires_at: expiresAt.toISOString(),
        token_type: data.token_type || 'Bearer',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error in google-refresh-token:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});