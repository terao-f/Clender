-- usersテーブルにis_sample_staffカラムを追加
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_sample_staff BOOLEAN DEFAULT FALSE;

-- 既存のユーザーをサンプル担当者として設定（必要に応じて調整）
-- UPDATE users SET is_sample_staff = TRUE WHERE id IN ('user1', 'user2');