# Google Meet 管理者権限テストガイド

## 問題の概要

`heartssh950@gmail.com`で Google Meet URL にアクセスした際に「参加をリクエスト」ボタンが表示される問題を解決するためのテストガイドです。

## 解決済みの修正内容

### 1. Google Meet URL 作成時の参加者設定

- ✅ `ReservationModal.tsx`: 参加者のメールアドレスを正しく取得・設定
- ✅ `googleCalendarSyncService.ts`: `scheduleToGoogleEvent`で参加者を設定
- ✅ `create-google-meet/index.ts`: 管理者を動的に取得して共同主催者として設定

### 2. 管理者権限の設定

- ✅ `heartssh950@gmail.com`を管理者として設定する SQL スクリプト作成
- ✅ Google Meet URL 作成時に管理者を共同主催者として追加するロジック実装

## テスト手順

### ステップ 1: 管理者権限の確認・設定

1. **Supabase ダッシュボードにアクセス**

   - https://supabase.com/dashboard/project/nyzdivpchfwywpsdgihw
   - SQL Editor を開く

2. **現在の状況を確認**

   ```sql
   -- check-users-status.sql の内容を実行
   SELECT id, email, role, name FROM users WHERE email = 'heartssh950@gmail.com';
   ```

3. **管理者権限を設定**
   ```sql
   -- setup-admin-simple.sql の内容を実行
   UPDATE users SET role = 'admin' WHERE email = 'heartssh950@gmail.com';
   ```

### ステップ 2: Google Meet URL 作成テスト

1. **アプリケーションにログイン**

   - ブラウザでアプリケーションを開く
   - 適当なユーザーでログイン

2. **テストスクリプトを実行**

   - ブラウザのコンソールを開く（F12）
   - `test-google-meet-admin.js`の内容をコピー&ペーストして実行

3. **結果を確認**
   - コンソールに表示される Meet URL とカレンダー URL をメモ

### ステップ 3: 管理者権限の確認

1. **heartssh950@gmail.comでアクセス**

   - 作成されたカレンダー URL を`heartssh950@gmail.com`で開く
   - 「参加をリクエスト」ボタンが表示されないことを確認

2. **Supabase ログの確認**
   - Supabase ダッシュボードの「Logs」セクションを開く
   - `create-google-meet`関数のログを確認
   - 以下のログが表示されることを確認：
     ```
     🔍 管理者メールアドレス: ['heartssh950@gmail.com', 'terao.form@gmail.com']
     🔍 heartssh950@gmail.comが管理者リストに含まれているか: true
     ```

## 期待される結果

### 成功の場合

- `heartssh950@gmail.com`でカレンダー URL にアクセスした際、「参加をリクエスト」ボタンが表示されない
- 会議の詳細を編集・削除できる
- Supabase ログで管理者メールアドレスが正しく取得されている

### 失敗の場合

- 「参加をリクエスト」ボタンが表示される
- 会議の詳細を編集・削除できない
- Supabase ログで管理者メールアドレスが取得できていない

## トラブルシューティング

### 問題 1: 管理者メールアドレスが取得できない

**原因**: `users`テーブルで`heartssh950@gmail.com`の`role`が`admin`に設定されていない

**解決方法**:

```sql
UPDATE users SET role = 'admin' WHERE email = 'heartssh950@gmail.com';
```

### 問題 2: 参加者が正しく設定されない

**原因**: `ReservationModal`で参加者のメールアドレスが取得できていない

**解決方法**: ブラウザのコンソールでエラーログを確認し、参加者データの取得状況を確認

### 問題 3: Google Meet URL が生成されない

**原因**: Google OAuth 認証の問題または API 制限

**解決方法**:

- Google 認証を再実行
- Supabase ログでエラー詳細を確認

## 関連ファイル

- `supabase/functions/create-google-meet/index.ts`: Google Meet URL 作成のメインロジック
- `src/components/ReservationModal.tsx`: 予定作成時の参加者設定
- `src/services/googleCalendarSyncService.ts`: カレンダー同期時の参加者設定
- `setup-admin-simple.sql`: 管理者権限設定用 SQL
- `check-users-status.sql`: ユーザー状況確認用 SQL
- `test-google-meet-admin.js`: テスト用 JavaScript スクリプト

## 完了条件

✅ `heartssh950@gmail.com`で Google Meet URL にアクセスした際に管理者権限を持つ
✅ 会議の詳細を編集・削除できる
✅ 他の参加者も正常に招待される
✅ Supabase ログで管理者メールアドレスが正しく取得されている
