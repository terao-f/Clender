# メール通知機能のセットアップ手順

## 重要：Resend の制限事項

**無料アカウントの制限：**

- テストメールは登録したメールアドレス（k.sho626626@gmail.com）にのみ送信可能
- 他のメールアドレスに送信するには、独自ドメインの検証が必要

## 解決方法

### オプション 1：テスト用（推奨）

全てのメールをあなたのアドレス（k.sho626626@gmail.com）に送信するようにテストできます。

### オプション 2：本番用

1. Resend で独自ドメインを検証
2. 検証済みドメインのメールアドレスを`from`アドレスとして使用

## 1. Resend API キーの取得

1. [Resend](https://resend.com)にアクセス
2. アカウントを作成またはログイン
3. ダッシュボードから「API Keys」を選択
4. 新しい API キーを作成してコピー

## 2. Supabase に環境変数を設定

以下のコマンドを実行して環境変数を設定します：

```bash
# プロジェクトディレクトリに移動
cd /Users/sho/Desktop/project\ 3

# RESEND_API_KEYを設定（your_resend_api_keyを実際のAPIキーに置き換えてください）
supabase secrets set RESEND_API_KEY=your_resend_api_key

# 送信元メールアドレスを設定（オプション）
supabase secrets set RESEND_FROM_EMAIL=noreply@yourdomain.com

# 送信者名を設定（オプション）
supabase secrets set RESEND_FROM_NAME="terao-f スケジューラー"
```

## 3. Edge Function のデプロイ

環境変数を設定後、Edge Function をデプロイします：

```bash
# Edge Functionをデプロイ
supabase functions deploy send-schedule-notification-email
```

## 4. 確認方法

1. ブラウザの開発者ツール（F12）を開く
2. Console タブを選択
3. 予約を作成して以下のログを確認：
   - `📧 === MyCalendarStandalone.addSchedule開始 ===`
   - `📧 メール送信チェック:`
   - `=== メール通知送信開始 ===`
   - `📧📧📧 Calling Edge Function: send-schedule-notification-email`

## トラブルシューティング

### Edge Function 500 エラーの場合

1. 環境変数が正しく設定されているか確認

```bash
supabase secrets list
```

2. Edge Function のログを確認

```bash
supabase functions logs send-schedule-notification-email
```

### メールが届かない場合

1. Resend ダッシュボードでメール送信ログを確認
2. 送信先メールアドレスが正しいか確認
3. 迷惑メールフォルダを確認

## 注意事項

- Resend の Free プランでは月 100 通までの制限があります
- 本番環境では独自ドメインのメールアドレスを使用することを推奨します
- テスト環境では `onboarding@resend.dev` が使用されます
