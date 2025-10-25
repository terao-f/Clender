-- ユーザーテーブルに人事フラグを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_hr BOOLEAN DEFAULT FALSE;

-- 既存のユーザーのis_hrフラグをfalseに設定
UPDATE users SET is_hr = FALSE WHERE is_hr IS NULL;