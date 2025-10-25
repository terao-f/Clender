# 📅 Googleカレンダー連携 セットアップガイド

## 🎯 概要
このガイドでは、Googleカレンダーとシステムを連携するための設定手順を説明します。

## 🔑 Google API キーの取得方法

### 1. Google Cloud Consoleでプロジェクトを作成

1. **Google Cloud Consoleにアクセス**
   - https://console.cloud.google.com/

2. **新しいプロジェクトを作成**
   - 画面上部の「プロジェクトを選択」をクリック
   - 「新しいプロジェクト」をクリック
   - プロジェクト名を入力（例：`calendar-sync-app`）
   - 「作成」をクリック

### 2. Google Calendar APIを有効化

1. **APIライブラリにアクセス**
   - 左側メニューから「APIとサービス」→「ライブラリ」を選択

2. **Google Calendar APIを検索**
   - 検索ボックスに「Google Calendar API」と入力
   - 検索結果から「Google Calendar API」をクリック

3. **APIを有効化**
   - 「有効にする」ボタンをクリック

### 3. OAuth 2.0 認証情報を作成

1. **認証情報ページにアクセス**
   - 左側メニューから「APIとサービス」→「認証情報」を選択

2. **OAuth同意画面を設定**
   - 「OAuth同意画面」タブをクリック
   - ユーザータイプで「外部」を選択（組織内限定の場合は「内部」）
   - 「作成」をクリック
   - 必須項目を入力：
     - アプリ名：`スケジュール管理システム`
     - ユーザーサポートメール：あなたのメールアドレス
     - デベロッパーの連絡先情報：あなたのメールアドレス
   - 「保存して次へ」をクリック

3. **スコープを追加**
   - 「スコープを追加または削除」をクリック
   - 以下のスコープを選択：
     - `../auth/calendar` - Googleカレンダーの表示と管理
     - `../auth/calendar.events` - カレンダーイベントの表示と編集
     - `../auth/userinfo.email` - メールアドレスの表示
     - `../auth/userinfo.profile` - プロフィール情報の表示
   - 「更新」をクリック
   - 「保存して次へ」をクリック

4. **テストユーザーを追加**（外部の場合）
   - 「ADD USERS」をクリック
   - テストユーザーのメールアドレスを入力
   - 「追加」をクリック
   - 「保存して次へ」をクリック

### 4. OAuth 2.0 クライアントIDを作成

1. **認証情報を作成**
   - 「認証情報」タブに戻る
   - 「認証情報を作成」→「OAuth クライアント ID」をクリック

2. **アプリケーションタイプを選択**
   - アプリケーションの種類：「ウェブアプリケーション」
   - 名前：`カレンダー連携クライアント`

3. **承認済みのリダイレクトURIを設定**
   - 「URIを追加」をクリック
   - 以下のURIを追加：
     - 開発環境：`http://localhost:5173/auth/google/callback`
     - 本番環境：`https://calendar-six-ecru.vercel.app/auth/google/callback`

4. **作成**
   - 「作成」ボタンをクリック
   - クライアントIDとクライアントシークレットが表示される
   - **これらの値を安全に保管してください**

### 5. 環境変数の設定

#### ローカル開発環境（.env.local）
```bash
# Google OAuth設定
VITE_GOOGLE_CLIENT_ID=あなたのクライアントID.apps.googleusercontent.com
```

#### Vercelの環境変数
Vercelダッシュボードで以下を設定：
- `VITE_GOOGLE_CLIENT_ID`: クライアントID

### 6. Supabase Edge Functionsの作成

以下のEdge Functionsを作成する必要があります：

#### `google-auth-callback` 関数
```typescript
// supabase/functions/google-auth-callback/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

serve(async (req) => {
  const { code, redirectUri } = await req.json()
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenResponse.json()
  
  return new Response(JSON.stringify(tokens), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

#### `google-refresh-token` 関数
```typescript
// supabase/functions/google-refresh-token/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

serve(async (req) => {
  const { refreshToken } = await req.json()
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await tokenResponse.json()
  
  return new Response(JSON.stringify(tokens), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### 7. Supabaseに環境変数を設定

Supabaseダッシュボードで以下の環境変数を設定：
- `GOOGLE_CLIENT_ID`: クライアントID
- `GOOGLE_CLIENT_SECRET`: クライアントシークレット

## 🚀 使用方法

1. **データベーステーブルを作成**
   ```sql
   -- database-google-calendar.sql を実行
   ```

2. **アプリケーションを起動**
   ```bash
   npm run dev
   ```

3. **Googleカレンダー連携ページにアクセス**
   - サイドバーから「Googleカレンダー」をクリック
   - 「Googleカレンダーと連携」ボタンをクリック
   - Googleアカウントでログイン
   - 権限を許可

4. **同期を実行**
   - 「今すぐ同期」ボタンをクリック
   - 過去1ヶ月から未来3ヶ月のイベントが同期される

## ⚠️ 注意事項

- **クライアントシークレットは絶対に公開しないでください**
- 開発環境と本番環境で異なるクライアントIDを使用することを推奨
- Google Cloud Consoleの無料枠内で十分動作します
- APIの使用量制限に注意してください（1日あたり1,000,000リクエストまで無料）

## 🔧 トラブルシューティング

### エラー：「認証に失敗しました」
- クライアントIDが正しく設定されているか確認
- リダイレクトURIが正しく設定されているか確認
- OAuth同意画面の設定が完了しているか確認

### エラー：「スコープが不足しています」
- OAuth同意画面で必要なスコープが追加されているか確認
- ユーザーが権限を許可したか確認

### エラー：「トークンの更新に失敗しました」
- クライアントシークレットが正しく設定されているか確認
- リフレッシュトークンが有効か確認

## 📚 参考リンク

- [Google Calendar API ドキュメント](https://developers.google.com/calendar/api/v3/reference)
- [Google OAuth 2.0 ドキュメント](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)