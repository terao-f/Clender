-- Googleカレンダーからの入力フラグにカラム名を変更するマイグレーション
-- 実行日: 2025-01-05

-- 既存のis_from_iphoneカラムをis_from_google_calendarに変更
ALTER TABLE schedules 
RENAME COLUMN is_from_iphone TO is_from_google_calendar;

-- インデックス名も変更
DROP INDEX IF EXISTS idx_schedules_is_from_iphone;
CREATE INDEX IF NOT EXISTS idx_schedules_is_from_google_calendar 
ON schedules(is_from_google_calendar);

-- コメントを更新
COMMENT ON COLUMN schedules.is_from_google_calendar IS 'Googleカレンダーからの入力かどうかを示すフラグ';

-- 確認用クエリ
SELECT 
  COUNT(*) as total_schedules,
  COUNT(CASE WHEN is_from_google_calendar = TRUE THEN 1 END) as google_calendar_schedules,
  COUNT(CASE WHEN is_from_google_calendar = FALSE THEN 1 END) as app_schedules
FROM schedules;
