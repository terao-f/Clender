# デプロイメント手順

## 環境変数の設定

### Vercel環境変数
以下の環境変数をVercelプロジェクトに設定してください：
- `VITE_SUPABASE_URL`: SupabaseプロジェクトのURL
- `VITE_SUPABASE_ANON_KEY`: Supabaseのanonymous key
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth2のクライアントID
- `VITE_GOOGLE_CLIENT_SECRET`: Google OAuth2のクライアントシークレット

### Supabase Edge Function環境変数
Supabaseプロジェクトに以下の環境変数を設定してください：
```bash
# Supabase CLIを使用する場合
supabase secrets set GOOGLE_CLIENT_ID=your_google_client_id_here
supabase secrets set GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

## Google Cloud Console設定

### OAuth 2.0 クライアントIDの設定
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを選択
3. 「APIとサービス」→「認証情報」
4. OAuth 2.0 クライアントIDを選択

### 承認済みのJavaScriptオリジン
以下のURLを追加：
- `https://calendar-six-ecru.vercel.app`
- `http://localhost:5173` (開発環境用)

### 承認済みのリダイレクトURI
以下のURLを追加：
- `https://calendar-six-ecru.vercel.app/auth/google/callback`
- `http://localhost:5173/auth/google/callback` (開発環境用)

## デプロイコマンド

### Vercelへのデプロイ
```bash
vercel --prod
```

### Supabase Edge Functionのデプロイ
```bash
supabase functions deploy google-auth-callback
```

## トラブルシューティング

### redirect_uri_mismatchエラー
1. ブラウザのコンソールで実際のリダイレクトURIを確認
2. Google Cloud ConsoleでそのURIが登録されているか確認
3. 環境変数が正しく設定されているか確認