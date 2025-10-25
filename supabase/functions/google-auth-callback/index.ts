import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  code: string;
  redirectUri: string;
}

serve(async (req: Request) => {
  // CORSプリフライトリクエスト処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, redirectUri } = await req.json() as RequestBody;
    
    if (!code) {
      throw new Error('Authorization code is required');
    }

    // Google OAuth2トークン交換
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      code,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
      redirect_uri: redirectUri || 'http://localhost:5173/auth/google/callback',
      grant_type: 'authorization_code',
    });

    console.log('Token exchange request:', {
      code: code.substring(0, 10) + '...',
      redirect_uri: redirectUri,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Google token exchange failed:', responseText);
      throw new Error(`Failed to exchange code: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      throw new Error('Invalid response from Google');
    }

    // アクセストークンの有効期限を計算
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));

    // ユーザー情報を取得
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${data.access_token}`,
      },
    });

    let userInfo = null;
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json();
    }

    return new Response(
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt.toISOString(),
        token_type: data.token_type || 'Bearer',
        scope: data.scope,
        user: userInfo,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error in google-auth-callback:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString(),
      }),
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