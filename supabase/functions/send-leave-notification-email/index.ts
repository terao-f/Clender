import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface LeaveNotificationEmailRequest {
  to: string[]
  type: 'group_approval_request' | 'president_approval_request' | 'approval_notification'
  leaveRequest: {
    id: string
    applicantName: string
    applicantDepartment: string
    leaveType: string
    startDate: string
    endDate?: string
    startTime?: string
    endTime?: string
    reason?: string
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('=== Leave Notification Email Function Called ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    console.log('RESEND_API_KEY available:', !!RESEND_API_KEY)
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }

    let requestBody;
    try {
      requestBody = await req.json()
      console.log('Request body received:', requestBody)
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      throw new Error('Invalid JSON in request body')
    }

    const { to, type, leaveRequest }: LeaveNotificationEmailRequest = requestBody

    console.log('Email recipients:', to)
    console.log('Email type:', type)

    if (!to || to.length === 0) {
      throw new Error('Recipients are required')
    }

    // Generate email content based on type
    const { subject, html } = generateEmailContent(type, leaveRequest)

    // Send email using Resend API
    console.log('Sending email with subject:', subject)
    console.log('Email recipients:', to)
    
    const emailPayload = {
      from: 'terao-f スケジューラー <noreply@terao-f.com>',
      to: to,
      subject: subject,
      html: html,
    }
    
    console.log('Email payload:', emailPayload)

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    console.log('Resend API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Resend API error:', errorText)
      throw new Error(`Resend API error: ${response.status} - ${errorText}`)
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
    console.error('Error sending leave notification email:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
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

function generateEmailContent(
  type: 'group_approval_request' | 'president_approval_request' | 'approval_notification',
  leaveRequest: any
): { subject: string; html: string } {
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = weekdays[date.getDay()]
    return `${year}年${month}月${day}日（${weekday}）`
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return ''
    return timeString.substring(0, 5) // HH:MM format
  }

  const getLeaveTypeDisplay = (leaveType: string) => {
    const typeMap: { [key: string]: string } = {
      'late': '遅刻',
      'early_leave': '早退', 
      'absence': '欠勤',
      'paid_leave': '有給休暇',
      'special_leave': '特別休暇'
    }
    return typeMap[leaveType] || leaveType
  }

  let subject = ''
  let messageTitle = ''
  let messageBody = ''

  switch (type) {
    case 'group_approval_request':
      subject = `【休暇申請承認依頼】${leaveRequest.applicantName}様の${getLeaveTypeDisplay(leaveRequest.leaveType)}申請`
      messageTitle = '休暇申請の承認依頼'
      messageBody = `
        <p>${leaveRequest.applicantName}様より休暇申請がありました。</p>
        <p><strong>承認をお願いいたします。</strong></p>
      `
      break

    case 'president_approval_request':
      subject = `【休暇申請最終承認依頼】${leaveRequest.applicantName}様の${getLeaveTypeDisplay(leaveRequest.leaveType)}申請`
      messageTitle = '休暇申請の最終承認依頼'
      messageBody = `
        <p>${leaveRequest.applicantName}様の休暇申請について、グループ承認が完了いたしました。</p>
        <p><strong>最終承認をお願いいたします。</strong></p>
      `
      break

    case 'approval_notification':
      subject = `【休暇申請承認完了】${leaveRequest.applicantName}様の${getLeaveTypeDisplay(leaveRequest.leaveType)}申請`
      messageTitle = '休暇申請承認完了のお知らせ'
      messageBody = `
        <p>${leaveRequest.applicantName}様の休暇申請が承認されました。</p>
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
    .details {
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
      width: 120px;
      flex-shrink: 0;
    }
    .detail-value {
      color: #1e293b;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
    }
    .important {
      background-color: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 4px;
      padding: 15px;
      margin: 15px 0;
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
      
      <div class="details">
        <div class="detail-row">
          <div class="detail-label">申請者名：</div>
          <div class="detail-value">${leaveRequest.applicantName}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">申請者所属：</div>
          <div class="detail-value">${leaveRequest.applicantDepartment}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">申請種別：</div>
          <div class="detail-value">${getLeaveTypeDisplay(leaveRequest.leaveType)}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">申請日時：</div>
          <div class="detail-value">
            ${formatDate(leaveRequest.startDate)}
            ${leaveRequest.startTime ? `${formatTime(leaveRequest.startTime)}〜` : ''}
            ${leaveRequest.endTime ? formatTime(leaveRequest.endTime) : ''}
            ${leaveRequest.endDate && leaveRequest.endDate !== leaveRequest.startDate ? 
              ` 〜 ${formatDate(leaveRequest.endDate)}` : ''}
          </div>
        </div>
        ${leaveRequest.reason ? `
        <div class="detail-row">
          <div class="detail-label">申請理由：</div>
          <div class="detail-value">${leaveRequest.reason}</div>
        </div>
        ` : ''}
      </div>

      ${type !== 'approval_notification' ? `
      <div class="important">
        <strong>※ システムにログインして承認処理を行ってください。</strong>
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