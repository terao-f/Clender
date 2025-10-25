-- スケジュール操作履歴テーブルの作成
CREATE TABLE IF NOT EXISTS schedule_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
  operator_id UUID NOT NULL REFERENCES users(id),
  operator_name TEXT NOT NULL,
  operation_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT NOT NULL,
  schedule_data JSONB, -- スケジュールの詳細データ（作成・更新時）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_schedule_history_schedule_id ON schedule_history(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_operator_id ON schedule_history(operator_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_operation_time ON schedule_history(operation_time);
CREATE INDEX IF NOT EXISTS idx_schedule_history_operation_type ON schedule_history(operation_type);

-- RLSポリシーの無効化（すべてのユーザーが履歴を閲覧可能）
ALTER TABLE schedule_history DISABLE ROW LEVEL SECURITY;