# Google カレンダー連携 完璧テストガイド

## 🎯 テスト目標

Google カレンダー連携が完璧に動作することを確認する

## 📋 事前準備

### 1. データベース修正

```sql
-- SupabaseのSQL Editorで実行
-- fix_google_calendar_token_issues.sql の内容をコピー&ペーストして実行
```

### 2. ブラウザ準備

- 開発者ツールを開く（F12）
- Console タブを選択
- ログをクリア

## 🧪 テスト手順

### テスト 1: 基本認証フロー

1. アプリにログイン
2. 設定 > Google カレンダー設定 に移動
3. 「Google カレンダーと連携」ボタンをクリック
4. Google 認証を完了
5. コンソールログを確認

**期待される結果:**

```
=== Token Exchange Debug ===
Token data from Edge Function: {...}
Tokens saved successfully
Tokens also saved to database
```

### テスト 2: 自動テストスクリプト実行

1. ブラウザのコンソールで以下を実行:

```javascript
// test-google-calendar.js の内容をコピー&ペースト
```

**期待される結果:**

```
🚀 Googleカレンダー連携テストを開始します...
=== テスト1: トークン状態確認 ===
Local Storage Tokens: EXISTS
Database Tokens: EXISTS
✅ 基本テスト完了！
```

### テスト 3: トークンリフレッシュテスト

1. コンソールで実行:

```javascript
window.GoogleCalendarDebugger.forceTokenExpiration();
await window.GoogleCalendarDebugger.testTokenRefresh();
```

**期待される結果:**

```
=== Token Refresh Debug ===
Token refresh successful
Refreshed tokens also saved to database
```

### テスト 4: エラーハンドリングテスト

1. コンソールで実行:

```javascript
window.GoogleCalendarDebugger.setInvalidRefreshToken();
await window.GoogleCalendarDebugger.testGetValidAccessToken();
```

**期待される結果:**

```
Refresh token is invalid, clearing stored tokens
Google認証が期限切れになりました
```

### テスト 5: カレンダー同期テスト

1. 予定を作成
2. コンソールログを確認

**期待される結果:**

```
=== アプリ → Google同期開始 ===
Googleカレンダーをクリア中...
アプリの予定を取得中...
```

### テスト 6: Google Meet 作成テスト

1. 予定に Google Meet を追加
2. メール送信をテスト
3. コンソールログを確認

**期待される結果:**

```
=== Sending Email via Supabase Edge Function ===
Edge Function response: {...}
Email sent successfully
```

## 🔧 トラブルシューティング

### 問題 1: 認証が失敗する

**症状:** Google 認証画面でエラー
**解決策:**

1. リダイレクト URI を確認
2. Google Cloud Console の設定を確認
3. 環境変数を確認

### 問題 2: トークンが保存されない

**症状:** 認証後も連携状態が表示されない
**解決策:**

```javascript
window.GoogleCalendarDebugger.checkTokenStatus();
```

### 問題 3: トークンリフレッシュが失敗する

**症状:** 定期的に連携が解除される
**解決策:**

```javascript
window.GoogleCalendarDebugger.clearAllTokens();
// 再認証を実行
```

### 問題 4: データベースエラー

**症状:** データベース関連のエラー
**解決策:**

1. RLS ポリシーを確認
2. テーブル構造を確認
3. 修正 SQL を再実行

## 📊 テスト結果記録

### テスト結果テンプレート

```markdown
## テスト結果 - [日時]

### テスト 1: 基本認証フロー

- [ ] 成功
- [ ] 失敗
- エラーメッセージ: ****\_\_\_****

### テスト 2: 自動テストスクリプト

- [ ] 成功
- [ ] 失敗
- エラーメッセージ: ****\_\_\_****

### テスト 3: トークンリフレッシュ

- [ ] 成功
- [ ] 失敗
- エラーメッセージ: ****\_\_\_****

### テスト 4: エラーハンドリング

- [ ] 成功
- [ ] 失敗
- エラーメッセージ: ****\_\_\_****

### テスト 5: カレンダー同期

- [ ] 成功
- [ ] 失敗
- エラーメッセージ: ****\_\_\_****

### テスト 6: Google Meet 作成

- [ ] 成功
- [ ] 失敗
- エラーメッセージ: ****\_\_\_****

## 総合評価

- [ ] 完璧に動作
- [ ] 一部問題あり
- [ ] 重大な問題あり

## 備考

---
```

## 🚀 デプロイ前チェックリスト

- [ ] データベース修正 SQL を実行済み
- [ ] 全テストが成功
- [ ] エラーハンドリングが適切
- [ ] ログ出力が適切
- [ ] ユーザー通知が適切
- [ ] トークン管理が統一されている
- [ ] Edge Function が正常動作

## 📞 サポート

問題が発生した場合:

1. コンソールログを確認
2. エラーメッセージを記録
3. テスト結果を記録
4. 必要に応じて修正を実施
