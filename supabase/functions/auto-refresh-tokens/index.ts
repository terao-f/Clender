import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORSプリフライトリクエスト処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 自動トークンリフレッシュ開始')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 有効期限が近いトークンを取得（30分以内に期限切れ）
    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    
    const { data: tokensToRefresh, error: fetchError } = await supabase
      .from('user_google_tokens')
      .select('*')
      .lte('expires_at', thirtyMinutesFromNow)
      .not('refresh_token', 'is', null)

    if (fetchError) {
      console.error('トークン取得エラー:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!tokensToRefresh || tokensToRefresh.length === 0) {
      console.log('リフレッシュ対象のトークンがありません')
      return new Response(
        JSON.stringify({ message: 'No tokens to refresh', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔄 ${tokensToRefresh.length}件のトークンをリフレッシュ中...`)

    let successCount = 0
    let errorCount = 0

    // 各トークンをリフレッシュ
    for (const tokenData of tokensToRefresh) {
      try {
        console.log(`🔄 ユーザー ${tokenData.user_id} のトークンをリフレッシュ中...`)

        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            refresh_token: tokenData.refresh_token,
            client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
            grant_type: 'refresh_token',
          }),
        })

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text()
          console.error(`❌ トークンリフレッシュ失敗 (${tokenData.user_id}):`, errorText)
          
          // リフレッシュトークンが無効な場合は削除
          if (errorText.includes('invalid_grant') || errorText.includes('invalid_request')) {
            console.log(`🗑️ 無効なリフレッシュトークンを削除: ${tokenData.user_id}`)
            await supabase
              .from('user_google_tokens')
              .delete()
              .eq('user_id', tokenData.user_id)
          }
          
          errorCount++
          continue
        }

        const refreshResult = await refreshResponse.json()
        const newExpiresAt = new Date(Date.now() + refreshResult.expires_in * 1000)

        // 新しいトークンを保存
        const { error: updateError } = await supabase
          .from('user_google_tokens')
          .update({
            access_token: refreshResult.access_token,
            expires_at: newExpiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', tokenData.user_id)

        if (updateError) {
          console.error(`❌ トークン更新失敗 (${tokenData.user_id}):`, updateError)
          errorCount++
        } else {
          console.log(`✅ トークンリフレッシュ成功: ${tokenData.user_id}`)
          successCount++
        }

        // API制限対策：リクエスト間に少し待機
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`❌ トークンリフレッシュエラー (${tokenData.user_id}):`, error)
        errorCount++
      }
    }

    console.log(`✅ 自動トークンリフレッシュ完了: 成功${successCount}件, エラー${errorCount}件`)

    return new Response(
      JSON.stringify({ 
        message: 'Token refresh completed',
        successCount,
        errorCount,
        totalProcessed: tokensToRefresh.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ 自動トークンリフレッシュエラー:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})










