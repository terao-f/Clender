-- Googleトークン保存用テーブルを作成
CREATE TABLE IF NOT EXISTS user_google_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- RLSを有効化
ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;

-- 公開アクセスを許可するポリシーを作成（認証システムがないため）
CREATE POLICY "Enable read access for all users" ON user_google_tokens
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON user_google_tokens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON user_google_tokens
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON user_google_tokens
  FOR DELETE USING (true);

-- updated_at を自動更新するトリガーを作成
CREATE TRIGGER update_user_google_tokens_updated_at BEFORE UPDATE
  ON user_google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- インデックスを作成
CREATE INDEX idx_user_google_tokens_user_id ON user_google_tokens(user_id);
CREATE INDEX idx_user_google_tokens_expires_at ON user_google_tokens(expires_at);

-- Google Calendar同期設定テーブル
CREATE TABLE IF NOT EXISTS google_calendar_sync_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  sync_to_google BOOLEAN DEFAULT true, -- アプリ→Google
  sync_from_google BOOLEAN DEFAULT false, -- Google→アプリ
  google_calendar_id VARCHAR(255) DEFAULT 'primary',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- RLSを有効化
ALTER TABLE google_calendar_sync_settings ENABLE ROW LEVEL SECURITY;

-- 公開アクセスを許可するポリシーを作成
CREATE POLICY "Enable read access for all users" ON google_calendar_sync_settings
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON google_calendar_sync_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON google_calendar_sync_settings
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON google_calendar_sync_settings
  FOR DELETE USING (true);

-- updated_at を自動更新するトリガーを作成
CREATE TRIGGER update_google_calendar_sync_settings_updated_at BEFORE UPDATE
  ON google_calendar_sync_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- スケジュールとGoogleイベントのマッピングテーブル
CREATE TABLE IF NOT EXISTS schedule_google_event_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  google_event_id VARCHAR(1024) NOT NULL,
  google_calendar_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(schedule_id, user_id)
);

-- RLSを有効化
ALTER TABLE schedule_google_event_mappings ENABLE ROW LEVEL SECURITY;

-- 公開アクセスを許可するポリシーを作成
CREATE POLICY "Enable read access for all users" ON schedule_google_event_mappings
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON schedule_google_event_mappings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON schedule_google_event_mappings
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON schedule_google_event_mappings
  FOR DELETE USING (true);

-- インデックスを作成
CREATE INDEX idx_schedule_google_event_mappings_schedule_id ON schedule_google_event_mappings(schedule_id);
CREATE INDEX idx_schedule_google_event_mappings_user_id ON schedule_google_event_mappings(user_id);
CREATE INDEX idx_schedule_google_event_mappings_google_event_id ON schedule_google_event_mappings(google_event_id);