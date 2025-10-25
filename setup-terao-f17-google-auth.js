// terao-f17@terao-f.co.jpユーザーのGoogle認証設定スクリプト
(async () => {
  try {
    console.log('🔧 terao-f17@terao-f.co.jpユーザーのGoogle認証設定開始');

    // Supabaseクライアントを取得
    const { createClient } = await import('@supabase/supabase-js');
    
    // CLIENT_TODO.mdから正しいAPIキーを使用
    const supabaseUrl = 'https://gbopssunwbzgtanrtxdr.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdib3Bzc3Vud2J6Z3RhbnJ0eGRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NTcyMjMsImV4cCI6MjA2ODEzMzIyM30.oQblEhOevFoeOPw4eC_lXU1Ljy7v13udJO9rMxyTrJs';
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ユーザー情報を取得
    console.log('👤 ユーザー情報を取得中...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('email', 'terao-f17@terao-f.co.jp')
      .single();

    if (userError || !userData) {
      console.error('❌ ユーザー取得エラー:', userError?.message || 'ユーザーが見つかりません');
      return;
    }

    console.log('✅ ユーザー情報:', {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role
    });

    // 既存のGoogle認証トークンを削除（クリーンな状態から開始するため）
    console.log('🔑 Google認証トークンを確認中...');
    const { data: existingTokens, error: existingTokensError } = await supabase
      .from('google_tokens')
      .select('id')
      .eq('user_id', userData.id);

    if (existingTokensError) {
      console.error('❌ 既存トークン確認エラー:', existingTokensError.message);
      return;
    }

    if (existingTokens && existingTokens.length > 0) {
      const { error: deleteError } = await supabase
        .from('google_tokens')
        .delete()
        .eq('user_id', userData.id);

      if (deleteError) {
        console.error('❌ 既存トークン削除エラー:', deleteError.message);
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
    console.log('2. terao-f17@terao-f.co.jpでGoogleにログイン');
    console.log('3. アプリのアクセス許可を与える');
    console.log('4. 認証完了後、このスクリプトを再実行');

    // Google同期設定を確認（存在しない場合は作成、存在する場合は更新）
    console.log('📅 Google同期設定を確認中...');
    const { data: existingSyncSettings, error: fetchSettingsError } = await supabase
      .from('google_calendar_sync_settings')
      .select('*')
      .eq('user_id', userData.id)
      .single();

    if (fetchSettingsError && fetchSettingsError.code !== 'PGRST116') { // PGRST116はデータがない場合
      console.error('❌ 同期設定取得エラー:', fetchSettingsError.message);
      return;
    }

    const syncSettings = {
      user_id: userData.id,
      google_calendar_id: 'primary',
      enabled: true,
      sync_from_google: true,
      sync_to_google: true,
      last_sync_at: null
    };

    if (existingSyncSettings) {
      const { error: updateError } = await supabase
        .from('google_calendar_sync_settings')
        .update(syncSettings)
        .eq('user_id', userData.id);
      if (updateError) {
        console.error('❌ 同期設定更新エラー:', updateError.message);
        return;
      }
      console.log('✅ Google同期設定を更新しました:', syncSettings);
    } else {
      const { error: insertError } = await supabase
        .from('google_calendar_sync_settings')
        .insert(syncSettings);
      if (insertError) {
        console.error('❌ 同期設定作成エラー:', insertError.message);
        return;
      }
      console.log('✅ Google同期設定を作成しました:', syncSettings);
    }

    console.log('🎉 terao-f17@terao-f.co.jpユーザーのGoogle認証設定完了');
    console.log('💡 次のステップ: Google認証URLで認証を完了してください');

  } catch (error) {
    console.error('❌ スクリプト実行中にエラーが発生:', error);
  }
})();
