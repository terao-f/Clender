# 開発者用ログイン情報

## クイックスタート

以下のアカウントでログインできます：

### 管理者アカウント
- **メール**: admin@example.com
- **パスワード**: admin123
- **権限**: 全機能にアクセス可能

### 一般ユーザーアカウント
- **メール**: dev1@example.com
- **パスワード**: dev123
- **権限**: 一般ユーザー機能のみ

### 人事部アカウント
- **メール**: hr@example.com
- **パスワード**: hr123
- **権限**: 休暇申請の承認が可能

### 社長アカウント
- **メール**: president@example.com
- **パスワード**: president123
- **権限**: 全機能にアクセス可能（最高権限）

## 全アカウント一覧

| 名前 | メールアドレス | パスワード | 権限 | 部署 | 備考 |
|------|----------------|------------|------|------|------|
| 社長太郎 | president@example.com | president123 | president | 経営企画部 | 最高権限 |
| 開発管理者 | admin@example.com | admin123 | admin | 開発部 | 管理者権限 |
| 人事部長 | hr@example.com | hr123 | hr | 人事部 | 休暇承認可能 |
| 開発太郎 | dev1@example.com | dev123 | member | 開発部 | 一般ユーザー |
| 開発花子 | dev2@example.com | dev123 | member | 開発部 | 一般ユーザー |
| 営業一郎 | sales1@example.com | test123 | member | 営業部 | 一般ユーザー |
| 営業二郎 | sales2@example.com | test123 | member | 営業部 | 一般ユーザー |
| 経理三郎 | accounting@example.com | test123 | member | 経理部 | 一般ユーザー |
| 総務四郎 | general@example.com | test123 | member | 総務部 | 一般ユーザー |
| パート花子 | part1@example.com | test123 | member | 営業部 | 週3日勤務（月・水・金） |
| パート太郎 | part2@example.com | test123 | member | 総務部 | 週3日勤務（火・水・木） |

## データベースへの登録方法

1. Supabaseのダッシュボードにログイン
2. SQL Editorを開く
3. `dev-login-data.sql`の内容をコピーして実行

または、コマンドラインから：

```bash
# Supabase CLIを使用する場合
supabase db push < dev-login-data.sql
```

## 注意事項

- これらのアカウントは開発・テスト用です
- 本番環境では使用しないでください
- パスワードは簡単なものになっているため、本番環境では必ず変更してください