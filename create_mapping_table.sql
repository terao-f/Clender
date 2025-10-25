-- スケジュールとGoogleイベントのマッピングテーブル作成
-- SupabaseダッシュボードのSQL Editorで実行してください

-- 既存の schedule_google_mappings テーブルが存在する場合は削除
DROP TABLE IF EXISTS public.schedule_google_mappings CASCADE;

-- スケジュールとGoogleイベントのマッピングテーブル
CREATE TABLE IF NOT EXISTS public.schedule_google_event_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  google_event_id VARCHAR(1024) NOT NULL,
  google_calendar_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(schedule_id, user_id),
  UNIQUE(google_event_id, user_id) -- GoogleイベントIDとユーザーIDの組み合わせもユニークにする
);

-- RLSを有効化
ALTER TABLE public.schedule_google_event_mappings ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
-- ユーザーは自分のマッピングのみ閲覧・編集可能
CREATE POLICY "Users can view own mappings" ON public.schedule_google_event_mappings
  FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own mappings" ON public.schedule_google_event_mappings
  FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update own mappings" ON public.schedule_google_event_mappings
  FOR UPDATE USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can delete own mappings" ON public.schedule_google_event_mappings
  FOR DELETE USING (user_id::text = auth.uid()::text);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_schedule_google_event_mappings_schedule_id ON public.schedule_google_event_mappings(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_google_event_mappings_user_id ON public.schedule_google_event_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_google_event_mappings_google_event_id ON public.schedule_google_event_mappings(google_event_id);

-- テーブル作成確認
SELECT 'schedule_google_event_mappings テーブルが正常に作成されました' as status;
