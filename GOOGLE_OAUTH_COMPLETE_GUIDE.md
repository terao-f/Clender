# Google OAuth設定 完全ガイド

## プロジェクト情報
- **Vercel本番URL**: `https://calendar-six-ecru.vercel.app`
- **Supabase URL**: `https://nyzdivpchfwywpsdgihw.supabase.co`
- **ローカル開発URL**: `http://localhost:5173`

## ステップ1: Google Cloud Consoleでプロジェクトを作成

1. **Google Cloud Consoleにアクセス**
   - https://console.cloud.google.com/

2. **新しいプロジェクトを作成（または既存のプロジェクトを選択）**
   - 上部のプロジェクト選択ドロップダウンから「新しいプロジェクト」
   - プロジェクト名: `Calendar App`（任意）
   - 作成をクリック

## ステップ2: Google Calendar APIを有効化

1. **APIライブラリに移動**
   - 左側メニュー → 「APIとサービス」→「ライブラリ」

2. **Google Calendar APIを検索して有効化**
   - 「Google Calendar API」を検索
   - 「有効にする」をクリック

## ステップ3: OAuth同意画面の設定

1. **OAuth同意画面に移動**
   - 左側メニュー → 「APIとサービス」→「OAuth同意画面」

2. **ユーザータイプを選択**
   - 「外部」を選択（個人のGoogleアカウントでもアクセス可能）
   - 「作成」をクリック

3. **アプリ情報を入力**
   - アプリ名: `Calendar App`
   - ユーザーサポートメール: あなたのメールアドレス
   - アプリのロゴ: （省略可）
   - アプリケーションのホームページ: `https://calendar-six-ecru.vercel.app`
   - アプリケーションのプライバシーポリシー: （省略可）
   - アプリケーションの利用規約: （省略可）
   - デベロッパーの連絡先情報: あなたのメールアドレス

4. **スコープを追加**
   - 「スコープを追加または削除」をクリック
   - 以下のスコープを検索して追加：
     ```
     https://www.googleapis.com/auth/calendar
     https://www.googleapis.com/auth/calendar.events
     https://www.googleapis.com/auth/userinfo.email
     https://www.googleapis.com/auth/userinfo.profile
     ```

5. **テストユーザーを追加**（開発中の場合）
   - テストユーザーを追加（あなたのGmailアドレス）

## ステップ4: OAuth 2.0 クライアントIDの作成

1. **認証情報に移動**
   - 左側メニュー → 「APIとサービス」→「認証情報」

2. **認証情報を作成**
   - 「+ 認証情報を作成」→「OAuth クライアント ID」

3. **アプリケーションの種類**
   - 「ウェブ アプリケーション」を選択

4. **名前**
   - `Calendar App Web Client`（任意）

5. **承認済みのJavaScriptオリジン**
   以下をすべて追加（+ボタンで追加）：
   ```
   https://calendar-six-ecru.vercel.app
   http://localhost:5173
   http://localhost:5174
   ```

6. **承認済みのリダイレクトURI**
   以下をすべて追加（+ボタンで追加）：
   ```
   https://calendar-six-ecru.vercel.app/auth/google/callback
   http://localhost:5173/auth/google/callback
   http://localhost:5174/auth/google/callback
   ```

7. **作成をクリック**

8. **クライアントIDとクライアントシークレットをメモ**
   作成後に表示される以下の情報を安全な場所にコピー：
   - クライアントID: `xxxxx.apps.googleusercontent.com`
   - クライアントシークレット: `GOCSPX-xxxxx`

## ステップ5: Vercelに環境変数を設定

1. **Vercelダッシュボードにアクセス**
   - https://vercel.com/dashboard

2. **プロジェクトを選択**
   - `calendar`プロジェクトをクリック

3. **Settings → Environment Variables**

4. **以下の環境変数を追加**
   | Key | Value | Environment |
   |-----|-------|-------------|
   | `VITE_GOOGLE_CLIENT_ID` | あなたのクライアントID | Production, Preview, Development |
   | `VITE_GOOGLE_CLIENT_SECRET` | あなたのクライアントシークレット | Production, Preview, Development |

5. **保存して再デプロイ**
   - 環境変数を追加後、プロジェクトを再デプロイ

## ステップ6: Supabaseに環境変数を設定

1. **Supabaseダッシュボードにアクセス**
   - https://app.supabase.com/

2. **プロジェクトを選択**
   - `FocusBuddy`プロジェクトをクリック

3. **Settings → Edge Functions**

4. **環境変数を追加**
   - `GOOGLE_CLIENT_ID`: あなたのクライアントID
   - `GOOGLE_CLIENT_SECRET`: あなたのクライアントシークレット

## ステップ7: 動作確認

1. **本番環境にアクセス**
   - https://calendar-six-ecru.vercel.app

2. **設定画面に移動**
   - 設定 → Google Calendar連携

3. **「Googleアカウントと連携」をクリック**

4. **正常に動作することを確認**

## トラブルシューティング

### エラー: redirect_uri_mismatch
- Google Cloud Consoleで設定したリダイレクトURIが正確か確認
- ブラウザのコンソールで実際のリダイレクトURIを確認

### エラー: 406 Not Acceptable
- Supabaseのテーブルが作成されているか確認
- RLSポリシーが正しく設定されているか確認

### エラー: Invalid client
- クライアントIDとクライアントシークレットが正しいか確認
- 環境変数が正しく設定されているか確認

## 必要な情報チェックリスト

- [ ] Google Cloud Consoleのプロジェクトを作成した
- [ ] Google Calendar APIを有効化した
- [ ] OAuth同意画面を設定した
- [ ] OAuth 2.0 クライアントIDを作成した
- [ ] クライアントIDをコピーした
- [ ] クライアントシークレットをコピーした
- [ ] Vercelに環境変数を設定した
- [ ] Supabaseに環境変数を設定した
- [ ] 本番環境で動作確認した