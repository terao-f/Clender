# Google Calendar連携セットアップガイド

## 概要
このシステムはGoogle Calendarとの双方向同期に対応しています。
ユーザーの予定をGoogle Calendarに自動反映し、Google Meetリンクも自動生成できます。

## 現在の実装状況

### ✅ 実装済み機能
1. **OAuth認証フロー** - Googleアカウントとの連携
2. **スケジュール→Googleカレンダー同期** - システムで作成した予定を自動でGoogleカレンダーに追加
3. **Google Meet自動生成** - オンライン会議の予定にGoogle Meet URLを自動付与
4. **設定画面** - 連携のON/OFF、同期設定の管理

### 🚧 追加実装が必要な機能
1. **Googleカレンダー→システム同期** - Googleカレンダーで作成した予定をシステムに取り込む
2. **リアルタイム同期** - 定期的な同期処理
3. **競合解決** - 両方で編集された場合の処理

## セットアップ手順

### 1. Google Cloud Consoleの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「認証情報」を開く
4. 「認証情報を作成」→「OAuth クライアント ID」を選択
5. アプリケーションタイプ：「ウェブアプリケーション」を選択
6. 以下の設定を行う：
   ```
   名前: グループスケジュール管理システム
   承認済みJavaScriptオリジン:
   - http://localhost:5173
   - https://[本番環境のドメイン]
   
   承認済みリダイレクトURI:
   - http://localhost:5173/auth/google/callback
   - https://[本番環境のドメイン]/auth/google/callback
   ```

7. Google Calendar APIを有効化：
   - 「APIとサービス」→「ライブラリ」
   - 「Google Calendar API」を検索して有効化

### 2. 環境変数の設定

`.env.local`ファイルに以下を設定：
```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
```

### 3. Supabase Edge Functionのデプロイ

```bash
# Supabase CLIをインストール
npm install -g supabase

# ログイン
supabase login

# Edge Functionをデプロイ
supabase functions deploy create-google-meet
```

### 4. データベースの準備

以下のテーブルが必要です（既に存在する場合はスキップ）：

```sql
-- Google Calendar同期設定
CREATE TABLE IF NOT EXISTS google_calendar_sync_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  sync_to_google boolean DEFAULT true,
  sync_from_google boolean DEFAULT false,
  google_calendar_id text DEFAULT 'primary',
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Google認証トークン
CREATE TABLE IF NOT EXISTS google_auth_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);
```

## 使用方法

### ユーザー側の操作

1. **初回連携**
   - 設定画面（⚙️）→「Google Calendar連携」を開く
   - 「Googleアカウントと連携」ボタンをクリック
   - Googleアカウントでログイン
   - 権限を許可

2. **同期設定**
   - 「システム→Google Calendar」：ONにするとシステムの予定がGoogleに反映
   - 「Google Calendar→システム」：ONにするとGoogleの予定がシステムに反映（実装予定）

3. **予定作成時**
   - 会議タイプで「オンライン」を選択するとGoogle Meet URLが自動生成
   - 参加者にメール通知も送信可能

### 管理者側の確認事項

1. **API利用状況**
   - Google Cloud Consoleで「APIとサービス」→「ダッシュボード」から確認
   - 無料枠：1日あたり1,000,000リクエスト

2. **エラー監視**
   - Supabaseダッシュボードでログを確認
   - Edge Functionsのエラーログもチェック

## トラブルシューティング

### 「認証エラー」が表示される場合
1. Google Cloud ConsoleでリダイレクトURIが正しく設定されているか確認
2. 環境変数が正しく設定されているか確認
3. ブラウザのキャッシュをクリア

### 同期されない場合
1. 設定画面で同期がONになっているか確認
2. Google Calendar APIが有効になっているか確認
3. Supabaseのログでエラーを確認

### Google Meetリンクが生成されない場合
1. 会議タイプが「オンライン」になっているか確認
2. Edge Functionが正しくデプロイされているか確認
3. Google Workspace（有料版）の場合は管理者設定を確認

## 今後の実装予定

1. **双方向リアルタイム同期**
   - Webhookを使用した即座の同期
   - 競合解決アルゴリズム

2. **複数カレンダー対応**
   - 仕事用/プライベート用の使い分け
   - チームカレンダーの作成

3. **高度な同期設定**
   - 特定のカテゴリのみ同期
   - 時間帯指定での同期

## お問い合わせ

不明点がある場合は、システム管理者までお問い合わせください。