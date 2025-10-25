-- 新しいSupabaseプロジェクトのセットアップスクリプト
-- このSQLをSupabaseダッシュボードのSQL Editorで実行してください

-- 1. notification_logsテーブルの作成
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'push', 'in_app')),
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. notification_preferencesテーブルの作成
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  schedule_created BOOLEAN DEFAULT true,
  schedule_updated BOOLEAN DEFAULT true,
  schedule_deleted BOOLEAN DEFAULT true,
  schedule_reminder BOOLEAN DEFAULT true,
  leave_request BOOLEAN DEFAULT true,
  leave_approved BOOLEAN DEFAULT true,
  leave_rejected BOOLEAN DEFAULT true,
  reminder_time INTEGER DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 3. email_templatesテーブルの作成
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_is_read ON notification_logs(is_read);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);

-- RLSポリシーの設定
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- notification_logsのRLSポリシー
CREATE POLICY "Users can view their own notification logs" ON notification_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notification logs" ON notification_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notification logs" ON notification_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- notification_preferencesのRLSポリシー
CREATE POLICY "Users can view their own notification preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- email_templatesのRLSポリシー
CREATE POLICY "Email templates are viewable by all authenticated users" ON email_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Email templates can be managed by admins" ON email_templates
  FOR ALL USING (true);

-- 4. メールテンプレートの挿入
INSERT INTO email_templates (name, subject, body_html, body_text, description)
VALUES (
  'schedule_created',
  '新しいスケジュール: {{title}}',
  '<h2>新しいスケジュールが作成されました</h2>
<p>{{userName}}様</p>
<p>以下のスケジュールが作成されました：</p>
<h3>{{title}}</h3>
<ul>
  <li><strong>日時:</strong> {{startTime}} - {{endTime}}</li>
  <li><strong>種類:</strong> {{type}}</li>
  {{#if location}}<li><strong>場所:</strong> {{location}}</li>{{/if}}
  {{#if details}}<li><strong>詳細:</strong> {{details}}</li>{{/if}}
  {{#if meetLink}}<li><strong>Google Meet:</strong> <a href="{{meetLink}}">参加する</a></li>{{/if}}
</ul>
<p><a href="{{calendarLink}}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">カレンダーで確認</a></p>
<hr>
<p><small>このメールは自動送信されています。</small></p>',
  '新しいスケジュールが作成されました

{{userName}}様

以下のスケジュールが作成されました：

{{title}}
日時: {{startTime}} - {{endTime}}
種類: {{type}}
{{#if location}}場所: {{location}}{{/if}}
{{#if details}}詳細: {{details}}{{/if}}
{{#if meetLink}}Google Meet: {{meetLink}}{{/if}}

カレンダーで確認: {{calendarLink}}

このメールは自動送信されています。',
  'スケジュール作成時に送信されるメールテンプレート'
);

INSERT INTO email_templates (name, subject, body_html, body_text, description)
VALUES 
('schedule_updated', 'スケジュール更新: {{title}}', '<h2>スケジュールが更新されました</h2>', 'スケジュールが更新されました', 'スケジュール更新時のメール'),
('schedule_deleted', 'スケジュール削除: {{title}}', '<h2>スケジュールが削除されました</h2>', 'スケジュールが削除されました', 'スケジュール削除時のメール'),
('schedule_reminder', 'リマインダー: {{title}}', '<h2>スケジュールのリマインダー</h2>', 'スケジュールのリマインダー', 'スケジュールリマインダーメール');