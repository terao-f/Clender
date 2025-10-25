import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  timeZone?: string;
  sendNotifications?: boolean;
  userId?: string;
}

// 管理者のメールアドレスを取得
async function getAdminEmails(): Promise<string[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('users')
    .select('email')
    .eq('role', 'admin');

  if (error || !data) {
    console.error('Failed to get admin emails:', error);
    return ['terao.form@gmail.com', 'heartssh950@gmail.com']; // フォールバック
  }

  return data.map(user => user.email);
}

// Google Calendar APIを使用してMeet URLを生成
async function createGoogleMeetEvent(
  accessToken: string,
  title: string,
  description: string,
  startTime: string,
  endTime: string,
  attendees: string[],
  timeZone: string = 'Asia/Tokyo'
) {
  
  // 管理者のメールアドレスを取得
  const adminEmails = await getAdminEmails();
  console.log('🔍 管理者メールアドレス:', adminEmails);
  console.log('🔍 参加者リスト:', attendees);
  console.log('🔍 heartssh950@gmail.comが管理者リストに含まれているか:', adminEmails.includes('heartssh950@gmail.com'));

  const event = {
    summary: title,
    description: description,
    start: {
      dateTime: startTime,
      timeZone: timeZone,
    },
    end: {
      dateTime: endTime,
      timeZone: timeZone,
    },
    attendees: [
      // 作成者を主催者として設定
      { email: attendees[0] || 'terao.form@gmail.com', role: 'organizer' },
      // 管理者を共同主催者として追加（作成者でない場合のみ）
      ...adminEmails
        .filter(adminEmail => adminEmail !== attendees[0])
        .map(adminEmail => ({ email: adminEmail, role: 'organizer' as const })),
      // その他の参加者
      ...attendees.slice(1).map(email => ({ email, role: 'required' as const }))
    ],
    // 主催者向けの管理機能を有効化
    guestsCanModify: false,
    guestsCanInviteOthers: false,
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet'
        }
      }
    }
  };

  console.log('📅 Google Meet会議作成:', {
    title,
    attendees: event.attendees,
    organizer: event.attendees.find(a => a.role === 'organizer'),
    coOrganizers: event.attendees.filter(a => a.role === 'organizer'),
    adminEmails: adminEmails
  });
  
  // 詳細な参加者情報をログ出力
  console.log('🔍 最終的な参加者リスト:');
  event.attendees.forEach((attendee, index) => {
    console.log(`  ${index + 1}. ${attendee.email} - ${attendee.role}`);
  });

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ユーザーのメールアドレスを取得
async function getUserEmail(userId: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Failed to get user email:', error);
    return null;
  }

  return data.email;
}

// ユーザーのアクセストークンを取得
async function getUserAccessToken(userId: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('user_google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Failed to get user tokens:', error);
    return null;
  }

  // トークンの有効性をチェック
  const expiresAt = new Date(data.expires_at);
  const now = new Date();

  if (expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)) {
    // トークンが期限切れまたは5分以内に期限切れの場合は更新
    try {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: data.refresh_token,
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh token');
      }

      const refreshData = await refreshResponse.json();
      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

      // 新しいトークンを保存
      await supabase
        .from('user_google_tokens')
        .update({
          access_token: refreshData.access_token,
          expires_at: newExpiresAt.toISOString(),
        })
        .eq('user_id', userId);

      return refreshData.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
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
    console.log('Creating Google Meet event:', body);
    
    if (!body.userId) {
      throw new Error('userId is required');
    }

    // ユーザーのアクセストークンを取得
    const accessToken = await getUserAccessToken(body.userId);
    if (!accessToken) {
      throw new Error('No valid Google access token found. Please re-authenticate with Google.');
    }

    // 作成者のメールアドレスを取得
    const creatorEmail = await getUserEmail(body.userId);
    if (!creatorEmail) {
      throw new Error('Failed to get creator email address.');
    }

    // 作成者を最初の参加者として追加（主催者にするため）
    const attendeesWithCreator = [creatorEmail, ...(body.attendees || [])];

    // Google Calendar APIを使用してMeet URLを生成
    const googleEvent = await createGoogleMeetEvent(
      accessToken,
      body.title,
      body.description || '',
      body.startTime,
      body.endTime,
      attendeesWithCreator,
      body.timeZone || 'Asia/Tokyo'
    );

  console.log('Google Meet event created:', googleEvent);
  console.log('📅 作成された会議の主催者:', googleEvent.organizer);
  console.log('📅 作成された会議の参加者:', googleEvent.attendees);
  console.log('📅 作成者メールアドレス:', creatorEmail);

  // Meet URLを取得
  const meetLink = googleEvent.conferenceData?.entryPoints?.[0]?.uri;
  if (!meetLink) {
    throw new Error('Failed to generate Google Meet URL');
  }

    const response = {
      id: googleEvent.id,
      meetLink: meetLink,
      calendarEventId: googleEvent.id,
      status: googleEvent.status,
      htmlLink: googleEvent.htmlLink,
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
    console.error('Error creating Google Meet:', error);
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