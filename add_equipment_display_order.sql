-- 1. roomsテーブルにdisplay_orderカラムを追加
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- 既存のルームに順序を設定
UPDATE rooms 
SET display_order = (
  SELECT COUNT(*) 
  FROM rooms r2 
  WHERE r2.created_at <= rooms.created_at
) - 1
WHERE display_order IS NULL OR display_order = 0;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_rooms_display_order ON rooms(display_order);

-- 2. vehiclesテーブルにdisplay_orderカラムを追加
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- 既存の車両に順序を設定
UPDATE vehicles 
SET display_order = (
  SELECT COUNT(*) 
  FROM vehicles v2 
  WHERE v2.created_at <= vehicles.created_at
) - 1
WHERE display_order IS NULL OR display_order = 0;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_vehicles_display_order ON vehicles(display_order);

-- 3. sample_equipmentテーブルにdisplay_orderカラムを追加
ALTER TABLE sample_equipment 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- 既存のサンプル設備に順序を設定
UPDATE sample_equipment 
SET display_order = (
  SELECT COUNT(*) 
  FROM sample_equipment se2 
  WHERE se2.created_at <= sample_equipment.created_at
) - 1
WHERE display_order IS NULL OR display_order = 0;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_sample_equipment_display_order ON sample_equipment(display_order);

-- 4. departmentsテーブルを作成（所属管理用）
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by UUID REFERENCES users(id)
);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_departments_display_order ON departments(display_order);

-- 既存の部署データを挿入
INSERT INTO departments (name, display_order) VALUES
  ('本社（１階）', 0),
  ('本社（２階）', 1),
  ('本社（３階）', 2),
  ('仕上げ・プレス', 3),
  ('CAD-CAM', 4),
  ('WEB', 5),
  ('所属なし', 6)
ON CONFLICT (name) DO NOTHING;

-- RLSを有効化
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが部署を閲覧可能
CREATE POLICY "Anyone can view departments" ON departments
  FOR SELECT USING (true);

-- 管理者のみ部署を作成・更新・削除可能
CREATE POLICY "Admins can manage departments" ON departments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.role = 'president')
    )
  );