# クライアント様　設定作業仕様書

## 作業概要

本番環境（https://calendar-six-ecru.vercel.app）でGoogle認証機能を有効にするための設定作業

## 必要な作業（所要時間：約 15 分）

### 1. Google Cloud Console の設定

#### アクセス方法

1. https://console.cloud.google.com/ にアクセス
2. プロジェクトを選択（既存のプロジェクトを使用）

#### 設定手順

1. 左側メニューから「API とサービス」をクリック
2. 「認証情報」をクリック
3. OAuth 2.0 クライアント ID の一覧から以下の ID をクリック：

   - `191598640659-jalhtobu09j26p4r09smun56eecb9ik5.apps.googleusercontent.com`

4. 設定画面で以下を追加：

   **承認済みの JavaScript オリジン**に追加：

   ```
   https://calendar-six-ecru.vercel.app
   ```

   **承認済みのリダイレクト URI**に追加：

   ```
   https://calendar-six-ecru.vercel.app/auth/google/callback
   ```

5. 画面下部の「保存」ボタンをクリック

### 2. Supabase Dashboard の設定

#### アクセス方法

1. https://app.supabase.com/ にアクセス
2. 対象プロジェクトを選択

#### 設定手順

##### A. 認証 URL 設定

1. 左側メニューから「Authentication」をクリック
2. 「URL Configuration」タブをクリック
3. 以下を設定：

   **Site URL**：

   ```
   https://calendar-six-ecru.vercel.app
   ```

   **Redirect URLs**に追加：

   ```
   https://calendar-six-ecru.vercel.app/**
   ```

4. 「Save」ボタンをクリック

##### B. メール送信設定

メール通知機能を使用する場合のみ設定が必要です。

1. 左側メニューから「Edge Functions」をクリック
2. 「send-email」関数を選択
3. 「Secrets」タブをクリック


   - Name: `RESEND_API_KEY`
   - Value: [re_biirE1yx_6sKMb5fgHgWeQcDedDgWDkhU]


## 設定完了後の確認

### 確認 URL

https://calendar-six-ecru.vercel.app

### 確認項目

1. ✅ ログインページが表示される
2. ✅ 「Google でログイン」ボタンが機能する
3. ✅ Google アカウントでログインできる

## トラブルシューティング

### 「リダイレクト URI が一致しません」エラーが出る場合

- Google Cloud Console でリダイレクト URI が正確に設定されているか確認
- URL の末尾に`/`が含まれていないか確認

### 「このサイトにアクセスできません」エラーが出る場合

- Supabase の Site URL が正しく設定されているか確認

## 設定値一覧（参考）

| 項目                 | 値                                                                       |
| -------------------- | ------------------------------------------------------------------------ |
| 本番 URL             | https://calendar-six-ecru.vercel.app                                     |
| Google Client ID     | 191598640659-jalhtobu09j26p4r09smun56eecb9ik5.apps.googleusercontent.com |
| Supabase Project URL | https://gbopssunwbzgtanrtxdr.supabase.co                                 |

## お問い合わせ

設定中に問題が発生した場合は、エラーメッセージのスクリーンショットと共にご連絡ください。
