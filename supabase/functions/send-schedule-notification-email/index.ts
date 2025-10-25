import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface ScheduleNotificationEmailRequest {
  to: string[]
  type: 'created' | 'updated' | 'deleted' | 'reminder' | 'meet_url'
  schedule: {
    id: string
    title: string
    description?: string
    startTime: string
    endTime: string
    type: string
    location?: string
    meetLink?: string
    participants: {
      id: string
      name: string
      email: string
    }[]
  }
  reminderMinutes?: number
  appUrl: string
  operatorName?: string // 操作者名を追加
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('=== Schedule Notification Email Function Called ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@terao-f.com'
    const RESEND_FROM_NAME = Deno.env.get('RESEND_FROM_NAME') || 'terao-f スケジューラー'
    
    console.log('RESEND_API_KEY available:', !!RESEND_API_KEY)
    console.log('RESEND_API_KEY prefix:', RESEND_API_KEY?.substring(0, 8))
    console.log('RESEND_FROM_EMAIL:', RESEND_FROM_EMAIL)
    console.log('RESEND_FROM_NAME:', RESEND_FROM_NAME)
    
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is missing')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'RESEND_API_KEY environment variable is not set' 
        }),
        { 
          status: 500,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    let requestBody;
    try {
      const bodyText = await req.text()
      console.log('Raw request body:', bodyText)
      requestBody = JSON.parse(bodyText)
      console.log('Parsed request body:', requestBody)
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid JSON in request body: ${parseError.message}` 
        }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    const { to, type, schedule, reminderMinutes, appUrl, operatorName }: ScheduleNotificationEmailRequest = requestBody

    // 必須フィールドのチェック
    if (!to || !Array.isArray(to) || to.length === 0) {
      console.error('Invalid or missing "to" field:', to)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or missing "to" field' 
        }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    if (!type) {
      console.error('Missing "type" field')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing "type" field' 
        }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    if (!schedule || !schedule.id) {
      console.error('Invalid or missing "schedule" field:', schedule)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or missing "schedule" field' 
        }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // appUrlが未定義の場合はデフォルト値を設定
    const finalAppUrl = appUrl || 'https://clender-app.vercel.app'
    console.log('appUrl from request:', appUrl)
    console.log('finalAppUrl:', finalAppUrl)

    // test-admin@terao-f.co.jp への送信を制限
    const BLOCKED_EMAIL = 'test-admin@terao-f.co.jp';
    const TEST_MODE = false; // 正常なメール送信を復活
    const TEST_EMAIL = 'k.sho626626@gmail.com';
    
    // test-admin@terao-f.co.jp を除外した受信者リストを作成
    const filteredRecipients = to.filter(email => email !== BLOCKED_EMAIL);
    
    // すべての受信者がブロックされた場合は送信をスキップ
    if (filteredRecipients.length === 0) {
      console.log('📧 すべての受信者がブロックされているため、送信をスキップします');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All recipients are blocked',
          skipped: true
        }),
        { 
          status: 200,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    const actualRecipients = filteredRecipients;
    
    console.log('Original recipients:', to)
    console.log('Filtered recipients (test-admin@terao-f.co.jp excluded):', actualRecipients)
    console.log('Blocked email:', BLOCKED_EMAIL)
    console.log('Email type:', type)
    console.log('Schedule data:', schedule)
    console.log('App URL:', appUrl)

    if (!to || to.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Recipients are required' 
        }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    if (!type || !schedule || !appUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: type, schedule, or appUrl' 
        }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // Generate email content based on type
    const { subject, html } = generateScheduleEmailContent(type, schedule, reminderMinutes, appUrl, operatorName)

    // Send email using Resend API
    console.log('Sending email with subject:', subject)
    
    // TEST_MODEの設定をここでも反映
    console.log('🚀 メール送信設定:')
    console.log('  - TEST_MODE:', TEST_MODE)
    console.log('  - 元の宛先:', to)
    console.log('  - 実際の宛先:', actualRecipients)
    
    const emailPayload = {
      from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
      to: actualRecipients, // TEST_MODEで変更された宛先を使用
      subject: TEST_MODE ? `[TEST] ${subject}` : subject, // テストモードの場合、件名に[TEST]を追加
      html: TEST_MODE ? `<div style="background-color: #FEF2E8; padding: 10px; margin-bottom: 20px; border: 1px solid #FCA311; border-radius: 5px;">
        <strong>⚠️ テストモード:</strong> このメールは本来以下の宛先に送信される予定でした:<br/>
        ${to.join(', ')}
      </div>${html}` : html, // テストモードの場合、本来の宛先を表示
    }
    
    console.log('📧 メール送信設定:')
    console.log('  - FROM:', emailPayload.from)
    console.log('  - TO:', emailPayload.to)
    console.log('  - SUBJECT:', emailPayload.subject)
    
    console.log('Email payload:', JSON.stringify(emailPayload, null, 2))

    console.log('=== Resend API呼び出し開始 ===')
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    console.log('Resend API response status:', response.status)
    console.log('Resend API response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText)
        console.error('Resend API error (JSON):', errorDetails)
        
        // Resendの一般的なエラーメッセージを分かりやすく変換
        let userFriendlyMessage = errorDetails.message || errorText
        if (errorDetails.name === 'validation_error' && errorDetails.message?.includes('from')) {
          userFriendlyMessage = `メールの送信元アドレス（${RESEND_FROM_EMAIL}）が認証されていません。Resendダッシュボードでドメインを追加・認証するか、環境変数RESEND_FROM_EMAILを'onboarding@resend.dev'に設定してください。`
        }
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: userFriendlyMessage,
            details: errorDetails
          }),
          { 
            status: 500,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        )
      } catch (e) {
        console.error('Resend API error (Text):', errorText)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Resend API error: ${response.status} - ${errorText}` 
          }),
          { 
            status: 500,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        )
      }
    }

    const result = await response.json()
    console.log('Resend API success result:', result)
    
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('=== Unexpected error in Edge Function ===')
    console.error('Error type:', typeof error)
    console.error('Error name:', error?.name)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    console.error('Full error object:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: typeof error,
        errorName: error?.name,
        fullError: String(error)
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})

function generateScheduleEmailContent(
  type: 'created' | 'updated' | 'deleted' | 'reminder' | 'meet_url',
  schedule: any,
  reminderMinutes?: number,
  appUrl?: string,
  operatorName?: string
): { subject: string; html: string } {
  
  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    
    // 日本時間に変換するためのオプション
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }
    
    // 日本時間でフォーマット
    const formatter = new Intl.DateTimeFormat('ja-JP', options)
    const parts = formatter.formatToParts(date)
    
    // パーツから各要素を取得
    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    const day = parts.find(p => p.type === 'day')?.value
    const weekday = parts.find(p => p.type === 'weekday')?.value
    const hour = parts.find(p => p.type === 'hour')?.value
    const minute = parts.find(p => p.type === 'minute')?.value
    
    return `${year}年${month}月${day}日（${weekday}） ${hour}:${minute}`
  }

  const getScheduleTypeDisplay = (scheduleType: string) => {
    const typeMap: { [key: string]: string } = {
      'meeting': '会議',
      'event': 'イベント',
      'appointment': '予定',
      'reminder': 'リマインダー',
      'other': 'その他'
    }
    return typeMap[scheduleType] || scheduleType
  }

  // 改行をHTMLに変換する関数
  const convertNewlinesToHtml = (text: string) => {
    if (!text) return ''
    return text
      .replace(/\n/g, '<br>')
      .replace(/\r\n/g, '<br>')
      .replace(/\r/g, '<br>')
  }

  let subject = ''
  let messageTitle = ''
  let messageBody = ''

  // 詳細画面へのリンクURL（削除の場合はカレンダーに直接遷移）
  let detailUrl = ''
  if (type === 'deleted') {
    // 削除の場合はカレンダーに遷移
    detailUrl = `${appUrl || 'https://clender-app.vercel.app'}/calendar/my`
  } else {
    // スケジュールの種類に応じて適切なカレンダーページに遷移
    switch (schedule.type) {
      case 'meeting':
        detailUrl = `${appUrl || 'https://clender-app.vercel.app'}/calendar/room?scheduleId=${schedule.id}`
        break
      case 'vehicle':
        detailUrl = `${appUrl || 'https://clender-app.vercel.app'}/calendar/vehicle?scheduleId=${schedule.id}`
        break
      case 'sample':
        detailUrl = `${appUrl || 'https://clender-app.vercel.app'}/calendar/sample?scheduleId=${schedule.id}`
        break
      default:
        detailUrl = `${appUrl || 'https://clender-app.vercel.app'}/calendar/my?scheduleId=${schedule.id}`
        break
    }
  }
  console.log('=== Generated Email URL ===')
  console.log('appUrl:', appUrl)
  console.log('schedule.id:', schedule.id)
  console.log('type:', type)
  console.log('detailUrl:', detailUrl)

  // 操作者名を取得（デフォルトは"管理者"）
  const operator = operatorName || '管理者'

  switch (type) {
    case 'created':
      subject = `${operator}がスケジュールを作成しました。`
      messageTitle = `${operator}がスケジュールを作成しました。`
      messageBody = `
        <p>新しいスケジュールが作成されました。</p>
        <p>詳細をご確認ください。</p>
      `
      break

    case 'updated':
      subject = `${operator}がスケジュールを編集しました。`
      messageTitle = `${operator}がスケジュールを編集しました。`
      messageBody = `
        <p>スケジュールが変更されました。</p>
        <p>変更内容をご確認ください。</p>
      `
      break

    case 'deleted':
      subject = `${operator}がスケジュールを削除しました。`
      messageTitle = `${operator}がスケジュールを削除しました。`
      messageBody = `
        <p>スケジュールが削除されました。</p>
        <p>ご確認ください。</p>
      `
      break

    case 'reminder':
      const minutes = reminderMinutes || 15
      subject = `予定の${minutes}分前です。`
      messageTitle = 'スケジュールリマインダー'
      messageBody = `
        <p>まもなく予定の開始時刻です。</p>
        <p><strong>${minutes}分後</strong>に開始予定です。</p>
      `
      break

    case 'meet_url':
      subject = 'Google Meet URLをお送りします'
      messageTitle = '株式会社テラオエフ'
      messageBody = schedule.description ? `<p>${convertNewlinesToHtml(schedule.description)}</p>` : `
        <p>以下の会議のGoogle Meet URLをお送りします。</p>
        <p>会議の時間になりましたら、下記のリンクからご参加ください。</p>
      `
      break
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { 
      font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; 
      line-height: 1.6; 
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px; 
      background-color: #ffffff;
    }
    .header { 
      background-color: #4F46E5; 
      color: white; 
      padding: 20px; 
      text-align: center; 
      border-radius: 8px 8px 0 0;
    }
    .header h2 {
      margin: 0;
      font-size: 20px;
    }
    .content { 
      background-color: #f8fafc; 
      padding: 30px; 
      border-radius: 0 0 8px 8px;
      border: 1px solid #e2e8f0;
    }
    .schedule-details {
      background-color: white;
      padding: 20px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      margin-bottom: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .detail-row:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    .detail-label {
      font-weight: bold;
      color: #475569;
      width: 100px;
      flex-shrink: 0;
    }
    .detail-value {
      color: #1e293b;
    }
    .participants {
      margin-top: 10px;
    }
    .participant {
      display: inline-block;
      background-color: #e0e7ff;
      color: #3730a3;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      margin: 2px;
    }
    .link-section {
      background-color: #dbeafe;
      border: 1px solid #3b82f6;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
    .detail-link {
      display: inline-block;
      background-color: #3b82f6;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      margin: 10px 0;
    }
    .detail-link:hover {
      background-color: #2563eb;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${messageTitle}</h2>
    </div>
    <div class="content">
      ${messageBody}
      
      <div class="schedule-details">
        <div class="detail-row">
          <div class="detail-label">タイトル：</div>
          <div class="detail-value">${schedule.title}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">種別：</div>
          <div class="detail-value">${getScheduleTypeDisplay(schedule.type)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">開始時刻：</div>
          <div class="detail-value">${formatDateTime(schedule.startTime)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">終了時刻：</div>
          <div class="detail-value">${formatDateTime(schedule.endTime)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">場所：</div>
          <div class="detail-value">${schedule.location || '未設定'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">会議リンク：</div>
          <div class="detail-value">${schedule.meetLink ? `<a href="${schedule.meetLink}" target="_blank">${schedule.meetLink}</a>` : 'なし'}</div>
        </div>
        ${type === 'meet_url' && schedule.meetLink ? `
        <div style="background-color: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <h3 style="color: #1d4ed8; margin: 0 0 15px 0; font-size: 18px;">🎥 Google Meet会議に参加</h3>
          <a href="${schedule.meetLink}" target="_blank" style="display: inline-block; background-color: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 10px 0;">
            会議に参加する
          </a>
          <p style="margin: 15px 0 0 0; font-size: 14px; color: #475569;">
            クリックするとGoogle Meetが開きます
          </p>
        </div>
        ` : ''}
        ${type !== 'meet_url' ? `
        ${schedule.description ? `
        <div class="detail-row">
          <div class="detail-label">詳細：</div>
          <div class="detail-value">${schedule.description}</div>
        </div>
        ` : ''}
        <div class="detail-row">
          <div class="detail-label">参加者：</div>
          <div class="detail-value">
            <div class="participants">
              ${schedule.participants.map((p: any) => `<span class="participant">${p.name}</span>`).join('')}
            </div>
          </div>
        </div>
        ` : ''}
      </div>

      ${type !== 'meet_url' ? `
      <div class="link-section">
        <p><strong>スケジュールの詳細を表示</strong></p>
        <a href="${detailUrl}" class="detail-link" target="_blank">
          詳細画面を開く
        </a>
        <p style="font-size: 12px; color: #64748b; margin-top: 10px;">
          上記リンクをクリックすると、ブラウザでスケジュールの詳細画面が開きます。
        </p>
      </div>
      ` : ''}
      
    </div>
    <div class="footer">
      <p>このメールは自動送信されています。</p>
      <p>株式会社テラオエフ</p>
    </div>
  </div>
</body>
</html>
  `.trim()

  return { subject, html }
}