import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  calendarEventId: string;
  coOrganizerEmail: string;
  userId: string;
}

// 既存のGoogle Calendarイベントに共同主催者を追加
async function addCoOrganizerToEvent(
  accessToken: string,
  calendarEventId: string,
  coOrganizerEmail: string
) {
  // まず既存のイベントを取得
  const getResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!getResponse.ok) {
    const errorText = await getResponse.text();
    throw new Error(`Failed to get event: ${getResponse.status} - ${errorText}`);
  }

  const existingEvent = await getResponse.json();

  // 共同主催者を追加
  const updatedEvent = {
    ...existingEvent,
    coOrganizers: [
      ...(existingEvent.coOrganizers || []),
      { email: coOrganizerEmail }
    ],
    // 主催者向けの管理機能を有効化
    guestsCanModify: false,
    guestsCanInviteOthers: false,
  };

  // イベントを更新
  const updateResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatedEvent),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to update event: ${updateResponse.status} - ${errorText}`);
  }

  return updateResponse.json();
}

// ユーザーのアクセストークンを取得
async function getUserAccessToken(userId: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('google_tokens')
    .select('access_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Error fetching access token:', error);
    return null;
  }

  // トークンの有効性をチェック
  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    console.log('Access token expired, attempting refresh...');
    
    // リフレッシュトークンを取得
    const { data: refreshData, error: refreshError } = await supabase
      .from('google_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .single();

    if (refreshError || !refreshData?.refresh_token) {
      console.error('No refresh token found:', refreshError);
      return null;
    }

    // トークンをリフレッシュ
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        refresh_token: refreshData.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshResponse.ok) {
      console.error('Token refresh failed');
      return null;
    }

    const refreshResult = await refreshResponse.json();
    
    // 新しいトークンを保存
    const expiresAt = new Date(Date.now() + refreshResult.expires_in * 1000);
    await supabase
      .from('google_tokens')
      .update({
        access_token: refreshResult.access_token,
        expires_at: expiresAt.toISOString(),
      })
      .eq('user_id', userId);

    return refreshResult.access_token;
  }

  return data.access_token;
}

serve(async (req: Request) => {
  // CORSプリフライトリクエスト処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    console.log('Adding co-organizer to Google Meet event:', body);
    
    if (!body.userId || !body.calendarEventId || !body.coOrganizerEmail) {
      throw new Error('userId, calendarEventId, and coOrganizerEmail are required');
    }

    // ユーザーのアクセストークンを取得
    const accessToken = await getUserAccessToken(body.userId);
    if (!accessToken) {
      throw new Error('No valid Google access token found. Please re-authenticate with Google.');
    }

    // 共同主催者を追加
    const updatedEvent = await addCoOrganizerToEvent(
      accessToken,
      body.calendarEventId,
      body.coOrganizerEmail
    );

    console.log('Co-organizer added successfully:', updatedEvent);

    const response = {
      success: true,
      eventId: updatedEvent.id,
      coOrganizers: updatedEvent.coOrganizers,
      message: '共同主催者が正常に追加されました'
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error adding co-organizer:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
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













