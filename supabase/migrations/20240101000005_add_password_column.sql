-- usersテーブルにpasswordカラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;

-- 既存ユーザーのパスワードをNULLから空文字列に設定（任意のパスワードでログイン可能）
UPDATE users SET password = '' WHERE password IS NULL;