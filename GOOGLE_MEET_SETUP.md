# 🚀 Google Meet自動作成機能 セットアップガイド

## 📋 概要
このシステムでは、会議予約時に自動的にGoogle Meet会議室を作成し、参加者にメールで招待を送信できます。

## 🔧 機能
- ✅ Google Calendar API経由でGoogle Meet会議室を自動作成
- ✅ 参加者への自動メール招待送信
- ✅ 会議リマインダーメール送信
- ✅ フォールバック機能（API連携失敗時はダミーリンク生成）

## 🛠️ セットアップ手順

### 1. Google Cloud Console設定

#### 1-1. プロジェクト作成
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成 または 既存プロジェクトを選択

#### 1-2. 必要なAPI有効化
1. 「APIとサービス」→「ライブラリ」
2. 「Google Calendar API」を検索して有効化
3. 「**Google Meet API**」または「**Conference Data API**」も検索して有効化（重要！）

#### 1-3. OAuth 2.0 認証情報作成
1. 「APIとサービス」→「認証情報」
2. 「認証情報を作成」→「OAuth 2.0 クライアントID」
3. アプリケーションタイプ：「ウェブアプリケーション」
4. 認証済みリダイレクトURI：`http://localhost:3000/auth/callback`

#### 1-4. サービスアカウント作成（推奨）
1. 「認証情報を作成」→「サービスアカウント」
2. サービスアカウント名を入力
3. JSONキーをダウンロード

### 2. 環境変数設定

#### 2-1. Supabaseプロジェクトの環境変数
Supabaseダッシュボードの「Settings」→「Environment Variables」で以下を設定：

```bash
# Google Calendar API設定
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret  
GOOGLE_ACCESS_TOKEN=your_access_token
GOOGLE_REFRESH_TOKEN=your_refresh_token

# メール送信（Resend）設定（オプション）
RESEND_API_KEY=your_resend_api_key
```

#### 2-2. ローカル開発用（.env.local）
```bash
# 既存の設定
VITE_SUPABASE_URL=https://nyzdivpchfwywpsdgihw.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Google Meet機能はSupabase Edge Functions経由で動作
# フロントエンドからは直接Google APIを呼び出しません
```

### 3. OAuth 2.0 トークン取得

#### 3-1. 認証URLにアクセス
```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/auth/callback&scope=https://www.googleapis.com/auth/calendar&response_type=code&access_type=offline
```

#### 3-2. 認証コードを取得
ブラウザでアクセスしてGoogleアカウントで認証後、リダイレクトURLから認証コードを取得

#### 3-3. トークン交換
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=AUTHORIZATION_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost:3000/auth/callback"
```

### 4. Supabase Edge Functions デプロイ

#### 4-1. Supabase CLIインストール
```bash
npm install -g supabase
```

#### 4-2. ログイン
```bash
supabase login
```

#### 4-3. Edge Functionsデプロイ
```bash
supabase functions deploy create-google-meet
supabase functions deploy send-email
```

## 🧪 動作テスト

### 1. 開発モードでのテスト
- Google API設定なしでも動作（フォールバック機能）
- ダミーMeetリンクが生成される
- メール内容はコンソールに出力される

### 2. 本番モードでのテスト
- Google Calendar APIで実際の会議が作成される
- Resend API経由でメールが送信される（設定時）

## 📝 使用方法

### 1. 会議予約作成
1. 「新しいスケジュール」で会議を作成
2. 種別で「オンライン商談」または「会議」を選択
3. 参加者を選択
4. 「作成」ボタンをクリック

### 2. 自動処理
- Google Meet会議室が自動作成される
- 参加者にメール招待が送信される
- スケジュールにMeet URLが保存される

## 🔍 トラブルシューティング

### Q: Google Meet会議室が作成されない
A: 以下を確認してください：
- Google Calendar APIが有効化されているか
- OAuth 2.0トークンが正しく設定されているか
- Supabase Edge Functionsがデプロイされているか

### Q: メールが送信されない
A: 開発モードではコンソールに出力されます。本番環境ではResend API設定が必要です。

### Q: 「フォールバック」と表示される
A: Google API連携が失敗した場合の正常な動作です。ダミーMeetリンクが生成されます。

## 🎯 今後の拡張予定
- [ ] Teams会議対応
- [ ] Zoom会議対応
- [ ] カレンダー同期機能
- [ ] 会議室予約状況の可視化

---

## 💡 簡単セットアップ（開発用）

Google API設定が複雑な場合は、現在のフォールバック機能（ダミーMeetリンク生成）をそのまま使用することも可能です。

```javascript
// 現在の動作：
// 1. オンライン会議を作成
// 2. ダミーMeetリンク（https://meet.google.com/xxx-xxx-xxx）が生成される
// 3. ユーザーは手動で実際のMeet会議を作成してリンクを更新可能
```

この方式でも十分に実用的なスケジュール管理システムとして機能します。