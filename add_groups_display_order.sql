-- groupsテーブルにdisplay_orderカラムを追加
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- 既存のグループに順序を設定
UPDATE groups 
SET display_order = (
  SELECT COUNT(*) 
  FROM groups g2 
  WHERE g2.created_at <= groups.created_at
) - 1
WHERE display_order IS NULL OR display_order = 0;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_groups_display_order ON groups(display_order);

-- RLSポリシーを更新して全社員がグループを操作できるようにする
DROP POLICY IF EXISTS "Users can view all groups" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Users can update groups" ON groups;
DROP POLICY IF EXISTS "Users can delete groups" ON groups;

-- 全ユーザーがグループを閲覧可能
CREATE POLICY "All authenticated users can view groups" ON groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 全ユーザーがグループを作成可能
CREATE POLICY "All authenticated users can create groups" ON groups
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() IN (SELECT id FROM users)
  );

-- 全ユーザーがグループを更新可能
CREATE POLICY "All authenticated users can update groups" ON groups
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND auth.uid() IN (SELECT id FROM users)
  );

-- 全ユーザーがグループを削除可能
CREATE POLICY "All authenticated users can delete groups" ON groups
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND auth.uid() IN (SELECT id FROM users)
  );