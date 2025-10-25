-- departmentsテーブルのRLSポリシーを更新して全社員が管理できるようにする

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Anyone can view departments" ON departments;
DROP POLICY IF EXISTS "Admins can manage departments" ON departments;

-- 全ユーザーが部署を閲覧可能
CREATE POLICY "All users can view departments" ON departments
  FOR SELECT USING (true);

-- 認証済みユーザーが部署を作成可能
CREATE POLICY "Authenticated users can create departments" ON departments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() IN (SELECT id FROM users)
  );

-- 認証済みユーザーが部署を更新可能
CREATE POLICY "Authenticated users can update departments" ON departments
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND auth.uid() IN (SELECT id FROM users)
  );

-- 認証済みユーザーが部署を削除可能
CREATE POLICY "Authenticated users can delete departments" ON departments
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND auth.uid() IN (SELECT id FROM users)
  );