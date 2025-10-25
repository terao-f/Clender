// terao-j@terao-f.co.jpユーザーのGoogle認証設定スクリプト
(async () => {
  try {
    console.log('🔧 terao-j@terao-f.co.jpユーザーのGoogle認証設定開始');
    
    // Supabaseクライアントを取得
    const { createClient } = await import('@supabase/supabase-js');
    
    // CLIENT_TODO.mdから正しいAPIキーを使用
    const supabaseUrl = 'https://gbopssunwbzgtanrtxdr.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdib3Bzc3Vud2J6Z3RhbnJ0eGRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NTcyMjMsImV4cCI6MjA2ODEzMzIyM30.oQblEhOevFoeOPw4eC_lXU1Ljy7v13udJO9rMxyTrJs';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // terao-j@terao-f.co.jpのユーザー情報を取得
    console.log('👤 ユーザー情報を取得中...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('email', 'terao-j@terao-f.co.jp')
      .single();
    
    if (userError || !userData) {
      console.error('❌ ユーザー取得エラー:', userError);
      return;
    }
    
    console.log('✅ ユーザー情報:', {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role
    });
    
    // Google認証トークンの確認
    console.log('🔑 Google認証トークンを確認中...');
    const { data: existingToken, error: tokenError } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', userData.id)
      .single();
    
    if (existingToken) {
      console.log('⚠️ 既にGoogleトークンが存在します:', {
        expires_at: existingToken.expires_at,
        created_at: existingToken.created_at
      });
      console.log('💡 既存のトークンを削除してから新しい認証を行います');
      
      // 既存のトークンを削除
      const { error: deleteError } = await supabase
        .from('google_tokens')
        .delete()
        .eq('user_id', userData.id);
      
      if (deleteError) {
        console.error('❌ 既存トークン削除エラー:', deleteError);
        return;
      }
      
      console.log('✅ 既存トークンを削除しました');
    }
    
    // Google認証URLを生成（CLIENT_TODO.mdから正しいClient IDを使用）
    const googleClientId = '191598640659-jalhtobu09j26p4r09smun56eecb9ik5.apps.googleusercontent.com';
    const googleAuthUrl = `https://accounts.google.com/oauth/authorize?` +
      `client_id=${googleClientId}&` +
      `redirect_uri=${encodeURIComponent('http://localhost:5173/auth/google/callback')}&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar')}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${userData.id}`;
    
    console.log('🔗 Google認証URL:');
    console.log(googleAuthUrl);
    console.log('\n📝 手順:');
    console.log('1. 上記のURLをブラウザで開く');
    console.log('2. terao-j@terao-f.co.jpでGoogleにログイン');
    console.log('3. アプリのアクセス許可を与える');
    console.log('4. 認証完了後、このスクリプトを再実行');
    
    // Google同期設定の確認・更新
    console.log('\n📅 Google同期設定を確認中...');
    const { data: syncSettings, error: syncError } = await supabase
      .from('google_calendar_sync_settings')
      .select('*')
      .eq('user_id', userData.id)
      .single();
    
    if (syncError || !syncSettings) {
      console.log('📅 Google同期設定を作成中...');
      const { error: createError } = await supabase
        .from('google_calendar_sync_settings')
        .insert({
          user_id: userData.id,
          google_calendar_id: 'primary',
          enabled: true,
          sync_from_google: true,
          sync_to_google: true,
          last_sync_at: null
        });
      
      if (createError) {
        console.error('❌ 同期設定作成エラー:', createError);
        return;
      }
      
      console.log('✅ Google同期設定を作成しました');
    } else {
      console.log('✅ Google同期設定は既に存在します:', {
        enabled: syncSettings.enabled,
        sync_from_google: syncSettings.sync_from_google,
        sync_to_google: syncSettings.sync_to_google
      });
    }
    
    console.log('\n🎉 terao-j@terao-f.co.jpユーザーのGoogle認証設定完了');
    console.log('💡 次のステップ: Google認証URLで認証を完了してください');
    
  } catch (error) {
    console.error('❌ スクリプト実行中にエラーが発生:', error);
  }
})();
