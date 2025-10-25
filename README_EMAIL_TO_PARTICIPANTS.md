# 参加者へのメール送信設定ガイド

## 現在の状況
- テストモード有効：全メールが k.sho626626@gmail.com に送信
- Resend無料プランの制限により、他のアドレスへの送信不可

## 参加者に直接送信する方法

### 方法1：独自ドメインを使用（推奨）

#### 必要なもの
- 独自ドメイン（例：yourdomain.com）
- ドメインのDNS設定権限

#### 手順

1. **Resendでドメインを追加**
   ```
   1. https://resend.com/domains にアクセス
   2. 「Add Domain」をクリック
   3. ドメイン名を入力（例：yourdomain.com）
   ```

2. **DNSレコードを設定**
   Resendが提供する以下のレコードをDNSに追加：
   - SPFレコード
   - DKIMレコード
   - MXレコード（オプション）

3. **ドメイン認証を待つ**
   - 通常数分〜数時間で認証完了
   - 認証状態はResendダッシュボードで確認

4. **Edge Functionを更新**
   ```typescript
   // TEST_MODEをfalseに変更
   const TEST_MODE = false;
   
   // FROM_EMAILを認証済みドメインのアドレスに変更
   const RESEND_FROM_EMAIL = 'noreply@yourdomain.com';
   ```

5. **Edge Functionを再デプロイ**

### 方法2：Supabaseのメール機能を使用

Supabaseの組み込みメール機能を使用（制限あり）

1. **Supabaseダッシュボード**
   - Authentication → Email Templates
   - カスタムSMTP設定

### 方法3：他のメールサービス

#### SendGrid
```bash
# 環境変数を設定
SENDGRID_API_KEY=your_api_key
```

#### Amazon SES
- AWSアカウントが必要
- 初期は制限モード（申請で解除可能）

## テストモードの解除手順

1. **MCPでEdge Functionを更新**
   ```typescript
   const TEST_MODE = false; // ← これを変更
   const TEST_EMAIL = 'k.sho626626@gmail.com';
   ```

2. **環境変数を確認**
   ```
   RESEND_FROM_EMAIL: 認証済みドメインのメールアドレス
   ```

3. **再デプロイ**

## 注意事項

### セキュリティ
- 本番環境では必ず認証済みドメインを使用
- SPF/DKIM設定で迷惑メール判定を回避

### 送信制限
- Resend無料: 100通/月、1通/秒
- SendGrid無料: 100通/日
- Amazon SES: 従量課金

### テスト推奨事項
1. まず少人数でテスト
2. 送信ログを確認
3. 迷惑メールフォルダをチェック
4. 段階的に本番環境へ移行

## トラブルシューティング

### メールが届かない場合
1. Resendダッシュボードでログ確認
2. ドメイン認証状態を確認
3. SPF/DKIM設定を再確認
4. 受信側の迷惑メールフィルタを確認

### エラー: "You can only send testing emails..."
→ ドメイン認証が未完了

### エラー: "Rate limit exceeded"
→ 送信制限に到達（時間を空けて再試行）