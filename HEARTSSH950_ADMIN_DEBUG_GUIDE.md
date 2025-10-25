# heartssh950@gmail.com 管理者権限デバッグガイド

## 問題の概要

`heartssh950@gmail.com` で Google Meet URL を開いた際に「参加リクエスト」ボタンが表示され、主催者権限がない状態になっている。

## デバッグ手順

### 1. データベースの管理者権限確認

#### ブラウザコンソールで実行:

```javascript
// 1. heartssh950@gmail.com の管理者権限を直接テスト
// このスクリプトをブラウザのコンソールにコピー&ペーストして実行
```

`test-heartssh950-admin-direct.js` の内容を実行してください。

#### 期待される結果:

- `heartssh950@gmail.com` の `role` が `admin` になっている
- 管理者ユーザー一覧に `heartssh950@gmail.com` が含まれている

### 2. Google Meet URL 作成時の詳細ログ確認

#### ブラウザコンソールで実行:

```javascript
// 2. 詳細ログ付きでGoogle Meet URL作成をテスト
// このスクリプトをブラウザのコンソールにコピー&ペーストして実行
```

`debug-google-meet-logs.js` の内容を実行してください。

### 3. Supabase ログの確認

1. Supabase ダッシュボードにアクセス
2. 「Logs」セクションを開く
3. `create-google-meet` 関数のログを探す
4. 以下のログメッセージを確認:

```
🔍 管理者メールアドレス: ['heartssh950@gmail.com', 'terao.form@gmail.com']
🔍 参加者リスト: ['heartssh950@gmail.com', 'test@example.com']
🔍 heartssh950@gmail.comが管理者リストに含まれているか: true
🔍 最終的な参加者リスト:
  1. heartssh950@gmail.com - organizer
  2. terao.form@gmail.com - organizer
  3. test@example.com - required
📅 作成された会議の主催者: { email: 'heartssh950@gmail.com', ... }
📅 作成された会議の参加者: [...]
```

### 4. 問題の特定

#### ケース 1: データベースで管理者権限がない

**症状**: `heartssh950@gmail.com` の `role` が `admin` でない
**解決策**: `test-heartssh950-admin-direct.js` を実行して管理者権限を設定

#### ケース 2: Edge Function で管理者が取得されていない

**症状**: ログで「管理者メールアドレス」が空または `heartssh950@gmail.com` が含まれていない
**解決策**: データベースの `users` テーブルを確認し、`role = 'admin'` のレコードが存在することを確認

#### ケース 3: 参加者リストの構築に問題がある

**症状**: ログで「最終的な参加者リスト」に `heartssh950@gmail.com` が `organizer` として含まれていない
**解決策**: Edge Function の `createGoogleMeetEvent` 関数の `attendees` 配列構築ロジックを確認

#### ケース 4: Google Calendar API の応答に問題がある

**症状**: ログで「作成された会議の主催者」が `heartssh950@gmail.com` でない
**解決策**: Google Calendar API の権限設定を確認

### 5. 手動での Google Meet URL 作成テスト

1. アプリで新しい予定を作成
2. 「オンライン会議」を選択
3. 参加者に `heartssh950@gmail.com` を追加
4. 予定を保存
5. 生成された Google Meet URL を `heartssh950@gmail.com` のアカウントで開く
6. 「参加リクエスト」ボタンが表示されないことを確認

### 6. トラブルシューティング

#### よくある問題と解決策:

1. **「参加リクエスト」ボタンが表示される**

   - 原因: `heartssh950@gmail.com` が `organizer` として設定されていない
   - 解決策: データベースの管理者権限と Edge Function のログを確認

2. **Edge Function でエラーが発生する**

   - 原因: Google OAuth トークンの期限切れまたは権限不足
   - 解決策: Google 認証を再実行

3. **管理者ユーザーが取得されない**
   - 原因: データベースの `users` テーブルに `role = 'admin'` のレコードがない
   - 解決策: 手動で管理者権限を設定

### 7. 確認事項チェックリスト

- [ ] `heartssh950@gmail.com` がデータベースの `users` テーブルに存在する
- [ ] `heartssh950@gmail.com` の `role` が `admin` になっている
- [ ] Edge Function のログで管理者メールアドレスが正しく取得されている
- [ ] Edge Function のログで `heartssh950@gmail.com` が `organizer` として設定されている
- [ ] Google Meet URL を `heartssh950@gmail.com` で開いて「参加リクエスト」ボタンが表示されない
- [ ] 作成された Google Calendar イベントで `heartssh950@gmail.com` が主催者になっている

### 8. 最終確認

すべての手順を完了した後、以下を確認してください:

1. **データベース確認**: `heartssh950@gmail.com` が管理者として設定されている
2. **ログ確認**: Edge Function のログで正しい参加者リストが構築されている
3. **実際の動作確認**: Google Meet URL で「参加リクエスト」ボタンが表示されない

問題が解決しない場合は、上記のログ情報を共有してください。
