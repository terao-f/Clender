-- 休暇申請責任者のロールを追加するSQL

-- 1. leave_requestsテーブルに休暇申請責任者の承認ステータスを追加
-- approversフィールドのJSONB構造を拡張して、manager_approval を追加

-- 2. 既存のleave_requestsのapproversフィールドを更新（必要に応じて）
UPDATE leave_requests
SET approvers = jsonb_set(
  COALESCE(approvers, '{}'::jsonb),
  '{manager_approval}',
  '{"status": "pending", "approved_at": null, "approved_by": null}'::jsonb,
  true
)
WHERE status != 'approved' AND status != 'rejected';

-- 3. ユーザーロールに'leave_manager'を追加可能にする
-- 既存のusersテーブルのroleカラムに新しい値を追加できるようにする
-- PostgreSQLのENUM型の場合は、新しい値を追加する必要があるが、
-- VARCHAR型の場合は特に変更は不要

-- 4. 休暇申請責任者用のビューを作成（オプション）
CREATE OR REPLACE VIEW leave_requests_for_manager AS
SELECT 
  lr.*,
  u.name as applicant_name,
  u.department as applicant_department,
  u.employee_id as applicant_employee_id,
  (approvers->>'group_approvals')::jsonb as group_approvals,
  (approvers->>'manager_approval')::jsonb as manager_approval,
  (approvers->>'president_approval')::jsonb as president_approval
FROM leave_requests lr
JOIN users u ON lr.user_id = u.id
WHERE 
  -- グループ承認が完了している
  (approvers->>'group_approvals')::jsonb->>'status' = 'approved'
  -- かつ、まだ責任者承認が完了していない
  AND (approvers->>'manager_approval')::jsonb->>'status' = 'pending';

-- 5. 休暇申請責任者を設定するための設定テーブルを作成
CREATE TABLE IF NOT EXISTS leave_manager_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- RLSを有効化
ALTER TABLE leave_manager_settings ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可能なポリシー
CREATE POLICY "Only admins can manage leave manager settings" ON leave_manager_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- インデックスを作成
CREATE INDEX idx_leave_manager_settings_user_id ON leave_manager_settings(user_id);
CREATE INDEX idx_leave_manager_settings_is_active ON leave_manager_settings(is_active);

-- 更新日時を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_leave_manager_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leave_manager_settings_updated_at 
  BEFORE UPDATE ON leave_manager_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_manager_settings_updated_at();