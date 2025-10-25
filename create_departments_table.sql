-- departmentsテーブルの作成と初期データの挿入

-- 1. departmentsテーブルを作成
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by UUID REFERENCES users(id)
);

-- 2. インデックスを作成
CREATE INDEX IF NOT EXISTS idx_departments_display_order ON departments(display_order);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);

-- 3. 既存の部署データを挿入（重複しない場合のみ）
INSERT INTO departments (name, display_order) VALUES
  ('本社（１階）', 0),
  ('本社（２階）', 1),
  ('本社（３階）', 2),
  ('仕上げ・プレス', 3),
  ('CAD-CAM', 4),
  ('WEB', 5),
  ('所属なし', 6)
ON CONFLICT (name) DO NOTHING;

-- 4. RLSを有効化
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- 5. 全ユーザーが部署を閲覧可能
CREATE POLICY "Anyone can view departments" ON departments
  FOR SELECT USING (true);

-- 6. 管理者と社長のみ部署を作成・更新・削除可能
CREATE POLICY "Admins can manage departments" ON departments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.role = 'president')
    )
  );

-- 7. updated_atを自動更新するトリガー関数を作成
CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. トリガーを作成
DROP TRIGGER IF EXISTS trigger_update_departments_updated_at ON departments;
CREATE TRIGGER trigger_update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_departments_updated_at();

-- 9. 確認用のクエリ
SELECT 'departments table created successfully' as status;
SELECT COUNT(*) as department_count FROM departments;
