-- サンプル予約用の生産番号と品番フィールドを追加

-- schedulesテーブルに生産番号と品番を追加
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS production_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);

-- 既存のサンプル予約データがある場合、タイトルから情報を抽出して移行
UPDATE schedules
SET 
  production_number = SPLIT_PART(title, '・', 1),
  product_code = SPLIT_PART(title, '・', 2)
WHERE 
  type = 'sample' 
  AND title LIKE '%・%・%'
  AND production_number IS NULL
  AND product_code IS NULL;

-- インデックスを追加してパフォーマンスを向上
CREATE INDEX IF NOT EXISTS idx_schedules_production_number ON schedules(production_number);
CREATE INDEX IF NOT EXISTS idx_schedules_product_code ON schedules(product_code);
CREATE INDEX IF NOT EXISTS idx_schedules_order_number ON schedules(order_number);

-- コメントを追加
COMMENT ON COLUMN schedules.production_number IS 'サンプル予約の生産番号';
COMMENT ON COLUMN schedules.product_code IS 'サンプル予約の品番';