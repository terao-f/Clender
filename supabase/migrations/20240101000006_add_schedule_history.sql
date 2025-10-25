-- スケジュール操作履歴テーブルの作成
CREATE TABLE IF NOT EXISTS public.schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
  operator_id UUID NOT NULL REFERENCES public.users(id),
  operator_name TEXT NOT NULL,
  operation_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT,
  schedule_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- インデックスを追加
CREATE INDEX idx_schedule_history_schedule_id ON public.schedule_history(schedule_id);
CREATE INDEX idx_schedule_history_operation_time ON public.schedule_history(operation_time DESC);
CREATE INDEX idx_schedule_history_operator_id ON public.schedule_history(operator_id);

-- RLSポリシーを追加
ALTER TABLE public.schedule_history ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー：すべての認証済みユーザーが閲覧可能
CREATE POLICY "schedule_history_select_policy" ON public.schedule_history
  FOR SELECT TO authenticated
  USING (true);

-- 挿入ポリシー：認証済みユーザーが挿入可能
CREATE POLICY "schedule_history_insert_policy" ON public.schedule_history
  FOR INSERT TO authenticated
  WITH CHECK (true);