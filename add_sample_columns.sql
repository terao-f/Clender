-- サンプル予約用のカラムを追加
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS quantity INTEGER,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_schedules_assigned_to ON schedules(assigned_to);
CREATE INDEX IF NOT EXISTS idx_schedules_type ON schedules(type);