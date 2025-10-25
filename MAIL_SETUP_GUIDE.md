# メール送信設定ガイド

## 開発環境での設定

開発環境では、実際のメール送信は不要で、コンソールログで確認できます。

### 1. 環境変数の設定（オプション）

`.env.local`ファイルに以下を追加：

```bash
# メールサービスのAPIキー（開発環境では不要）
RESEND_API_KEY=your_resend_api_key_here
```

### 2. Supabase Edge Functionの設定

```bash
# Edge Functionのシークレットを設定（本番環境用）
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

## 本番環境での設定

### Resendを使用する場合

1. **アカウント作成**
   - https://resend.com にアクセス
   - Sign upでアカウント作成
   - メールアドレスを確認

2. **APIキーの取得**
   - ダッシュボードにログイン
   - API Keys セクションへ
   - 「Create API Key」をクリック
   - キーをコピー

3. **ドメイン設定（オプション）**
   - 独自ドメインから送信する場合
   - Domains セクションで設定
   - DNSレコードを追加

4. **Supabaseに設定**
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
   supabase functions deploy send-email
   ```

## テスト用の設定

開発環境では、メール送信をモックしているため、以下の機能が利用可能：

- **コンソールログ**: ブラウザの開発者ツールでメール内容を確認
- **ローカルストレージ**: 送信履歴を保存
- **UI確認**: 実際の送信フローを確認

## メールテンプレート

EmailSendModalには以下のテンプレートが含まれています：

1. **会議招待**
   - 件名: 【会議招待】{{title}} - {{date}}
   - 参加者、日時、場所、Google Meetリンクを含む

2. **リマインダー**
   - 件名: 【リマインダー】{{title}} - {{date}}
   - 本日の予定をリマインド

3. **予定変更通知**
   - 件名: 【予定変更】{{title}} - {{date}}
   - 変更された予定の詳細

## トラブルシューティング

### CORSエラーが発生する場合

1. Supabase Dashboardで Functions の設定を確認
2. Edge FunctionのCORSヘッダーが正しく設定されているか確認
3. 開発環境ではモック送信が自動的に使用されます

### メールが届かない場合

1. APIキーが正しく設定されているか確認
2. 送信元メールアドレスが認証されているか確認
3. スパムフォルダを確認
4. Resendのダッシュボードでログを確認