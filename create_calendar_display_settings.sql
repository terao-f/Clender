-- カレンダー表示設定テーブルを作成
CREATE TABLE IF NOT EXISTS calendar_display_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visible_user_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- RLSを有効化
ALTER TABLE calendar_display_settings ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の設定のみ読み書きできる
CREATE POLICY "Users can view own calendar settings" ON calendar_display_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own calendar settings" ON calendar_display_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar settings" ON calendar_display_settings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar settings" ON calendar_display_settings
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at を自動更新するトリガーを作成
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_calendar_display_settings_updated_at BEFORE UPDATE
  ON calendar_display_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- インデックスを作成
CREATE INDEX idx_calendar_display_settings_user_id ON calendar_display_settings(user_id);