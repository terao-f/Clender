-- リマインダー送信ログテーブル
CREATE TABLE IF NOT EXISTS reminder_logs (
    id BIGSERIAL PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    reminder_minutes INTEGER NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- インデックス用の複合制約
    UNIQUE(schedule_id, reminder_minutes)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_reminder_logs_schedule_id ON reminder_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_sent_at ON reminder_logs(sent_at);

-- RLS (Row Level Security) を有効化
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLSポリシー設定（すべてのユーザーが読み書き可能）
CREATE POLICY "Enable all operations for reminder_logs" ON reminder_logs
    FOR ALL USING (true);

-- テーブルコメント
COMMENT ON TABLE reminder_logs IS 'スケジュールリマインダーの送信ログを管理するテーブル';
COMMENT ON COLUMN reminder_logs.schedule_id IS 'スケジュールID';
COMMENT ON COLUMN reminder_logs.reminder_minutes IS 'リマインダー送信時間（開始何分前）';
COMMENT ON COLUMN reminder_logs.sent_at IS 'リマインダー送信日時';

-- 動作確認用のクエリ
-- SELECT * FROM reminder_logs ORDER BY sent_at DESC LIMIT 10;