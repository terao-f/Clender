-- iPhoneからの入力フラグを追加するマイグレーション
-- 実行日: 2025-01-05

-- schedulesテーブルにis_from_iphoneカラムを追加
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS is_from_iphone BOOLEAN DEFAULT FALSE;

-- 既存のレコードは全てFALSEに設定（iPhone以外からの入力とみなす）
UPDATE schedules 
SET is_from_iphone = FALSE 
WHERE is_from_iphone IS NULL;

-- カラムにNOT NULL制約を追加
ALTER TABLE schedules 
ALTER COLUMN is_from_iphone SET NOT NULL;

-- インデックスを追加（iPhoneからのスケジュール検索用）
CREATE INDEX IF NOT EXISTS idx_schedules_is_from_iphone 
ON schedules(is_from_iphone);

-- コメントを追加
COMMENT ON COLUMN schedules.is_from_iphone IS 'iPhoneからの入力かどうかを示すフラグ';

-- 確認用クエリ
SELECT 
  COUNT(*) as total_schedules,
  COUNT(CASE WHEN is_from_iphone = TRUE THEN 1 END) as iphone_schedules,
  COUNT(CASE WHEN is_from_iphone = FALSE THEN 1 END) as non_iphone_schedules
FROM schedules;
