-- 自動トークンリフレッシュ用のcronジョブを設定
-- 15分間隔でトークンの有効期限をチェックし、必要に応じてリフレッシュ

-- pg_cron拡張機能を有効化（既に有効化されている場合はスキップ）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 既存のcronジョブを削除（重複を避けるため）
SELECT cron.unschedule('auto-refresh-google-tokens');

-- 15分間隔で自動トークンリフレッシュを実行
SELECT cron.schedule(
  'auto-refresh-google-tokens',
  '*/15 * * * *', -- 15分間隔
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/auto-refresh-tokens',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- ログ用のテーブルを作成（オプション）
CREATE TABLE IF NOT EXISTS token_refresh_logs (
  id SERIAL PRIMARY KEY,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  details JSONB
);

-- ログを記録する関数
CREATE OR REPLACE FUNCTION log_token_refresh_result(
  p_success_count INTEGER,
  p_error_count INTEGER,
  p_total_processed INTEGER,
  p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO token_refresh_logs (
    success_count,
    error_count,
    total_processed,
    details
  ) VALUES (
    p_success_count,
    p_error_count,
    p_total_processed,
    p_details
  );
END;
$$ LANGUAGE plpgsql;

-- 成功時の通知（オプション）
COMMENT ON FUNCTION log_token_refresh_result IS 'トークンリフレッシュの結果をログに記録する関数';










