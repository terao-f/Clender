# Resendメール送信設定

## 1. Resendアカウント作成
1. https://resend.com にアクセス
2. 無料アカウントを作成（月3,000通まで無料）
3. ダッシュボードからAPIキーをコピー

## 2. Supabaseに環境変数を設定
```bash
# ResendのAPIキーを設定（YOUR_RESEND_API_KEYを実際のAPIキーに置き換えてください）
supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY --project-ref uiqiuffeccxxcaisprxn
```

## 3. Edge Functionをデプロイ
```bash
supabase functions deploy send-email --project-ref uiqiuffeccxxcaisprxn
```

## Resendの特徴
- ドメイン認証不要ですぐに使える
- 開発中は`onboarding@resend.dev`から送信可能
- 本番環境では独自ドメインを追加可能
- シンプルなAPI
- 高い到達率

## テスト送信
アプリケーションで新しいスケジュールを作成してメールが届くか確認してください。