-- サンプル予約用のカラムを追加
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS order_number INTEGER,
ADD COLUMN IF NOT EXISTS production_number VARCHAR(255),
ADD COLUMN IF NOT EXISTS product_code VARCHAR(255),
ADD COLUMN IF NOT EXISTS quantity INTEGER,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- order_numberにインデックスを追加（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_schedules_order_number ON schedules(order_number);

-- 日付と設備でのフィルタリング用の複合インデックス
CREATE INDEX IF NOT EXISTS idx_schedules_start_time_equipment ON schedules(start_time, equipment);