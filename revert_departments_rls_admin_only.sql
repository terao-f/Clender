-- departmentsテーブルのRLSポリシーを管理者のみに戻す

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "All users can view departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can create departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can update departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can delete departments" ON departments;

-- 全ユーザーが部署を閲覧可能（これは維持）
CREATE POLICY "Anyone can view departments" ON departments
  FOR SELECT USING (true);

-- 管理者と社長のみ部署を作成可能
CREATE POLICY "Admins can create departments" ON departments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.role = 'president')
    )
  );

-- 管理者と社長のみ部署を更新可能
CREATE POLICY "Admins can update departments" ON departments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.role = 'president')
    )
  );

-- 管理者と社長のみ部署を削除可能
CREATE POLICY "Admins can delete departments" ON departments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.role = 'president')
    )
  );