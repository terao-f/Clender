-- Googleカレンダー連携用のテーブル作成

-- ユーザーのGoogleトークンを保存するテーブル
CREATE TABLE IF NOT EXISTS user_google_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- スケジュールとGoogleカレンダーイベントのマッピングテーブル
CREATE TABLE IF NOT EXISTS schedule_google_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(schedule_id),
  UNIQUE(google_event_id)
);

-- RLSポリシー
ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_google_mappings ENABLE ROW LEVEL SECURITY;

-- user_google_tokensのポリシー
-- ユーザーは自分のトークンのみ閲覧・編集可能
CREATE POLICY "Users can view own google tokens" ON user_google_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own google tokens" ON user_google_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own google tokens" ON user_google_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own google tokens" ON user_google_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- schedule_google_mappingsのポリシー
-- スケジュールの作成者のみマッピングを操作可能
CREATE POLICY "Users can view google mappings for own schedules" ON schedule_google_mappings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.id = schedule_google_mappings.schedule_id
      AND schedules.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert google mappings for own schedules" ON schedule_google_mappings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.id = schedule_google_mappings.schedule_id
      AND schedules.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update google mappings for own schedules" ON schedule_google_mappings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.id = schedule_google_mappings.schedule_id
      AND schedules.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete google mappings for own schedules" ON schedule_google_mappings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.id = schedule_google_mappings.schedule_id
      AND schedules.created_by = auth.uid()
    )
  );

-- インデックス作成
CREATE INDEX idx_user_google_tokens_user_id ON user_google_tokens(user_id);
CREATE INDEX idx_schedule_google_mappings_schedule_id ON schedule_google_mappings(schedule_id);
CREATE INDEX idx_schedule_google_mappings_google_event_id ON schedule_google_mappings(google_event_id);