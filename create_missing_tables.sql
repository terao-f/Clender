-- 不足しているテーブルを作成するSQL
-- このファイルをSupabaseのSQL Editorで実行してください

-- 1. user_google_tokens テーブル（Google認証用）
CREATE TABLE IF NOT EXISTS user_google_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLSを有効化
ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "Users can view own tokens" ON user_google_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON user_google_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON user_google_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON user_google_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- 2. notification_preferences テーブル（通知設定用）
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  schedule_created BOOLEAN DEFAULT true,
  schedule_updated BOOLEAN DEFAULT true,
  schedule_deleted BOOLEAN DEFAULT true,
  schedule_reminder BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLSを有効化
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "Users can view own preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. schedule_google_mappings テーブル（Googleカレンダー連携用）
CREATE TABLE IF NOT EXISTS schedule_google_mappings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(schedule_id, user_id)
);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_google_mappings_schedule_id ON schedule_google_mappings(schedule_id);
CREATE INDEX IF NOT EXISTS idx_google_mappings_user_id ON schedule_google_mappings(user_id);

-- RLSを有効化
ALTER TABLE schedule_google_mappings ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "Users can view own mappings" ON schedule_google_mappings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mappings" ON schedule_google_mappings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mappings" ON schedule_google_mappings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mappings" ON schedule_google_mappings
  FOR DELETE USING (auth.uid() = user_id);