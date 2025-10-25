-- メール送信履歴テーブルの作成
CREATE TABLE IF NOT EXISTS public.email_send_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id),
  sender_name TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('meet_url', 'reminder', 'update', 'cancel', 'custom')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- インデックスを追加
CREATE INDEX idx_email_send_history_schedule_id ON public.email_send_history(schedule_id);
CREATE INDEX idx_email_send_history_sent_at ON public.email_send_history(sent_at DESC);
CREATE INDEX idx_email_send_history_sender_id ON public.email_send_history(sender_id);

-- RLSポリシーを追加
ALTER TABLE public.email_send_history ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー：すべての認証済みユーザーが閲覧可能
CREATE POLICY "email_send_history_select_policy" ON public.email_send_history
  FOR SELECT TO authenticated
  USING (true);

-- 挿入ポリシー：認証済みユーザーが挿入可能
CREATE POLICY "email_send_history_insert_policy" ON public.email_send_history
  FOR INSERT TO authenticated
  WITH CHECK (true);