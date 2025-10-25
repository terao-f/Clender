-- 社内スケジュール管理システム データベーススキーマ

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_kana VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  department VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'admin', 'president')),
  is_hr BOOLEAN DEFAULT FALSE,
  default_work_days JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups table
CREATE TABLE groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('business', 'leave')),
  members UUID[] DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rooms table
CREATE TABLE rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles table
CREATE TABLE vehicles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  license_plate VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sample equipment table
CREATE TABLE sample_equipment (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('CAD・マーキング', 'サンプル裁断', 'サンプル縫製', 'サンプル内職', 'プレス', '仕上げ・梱包')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedules table
CREATE TABLE schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  details TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_all_day BOOLEAN DEFAULT FALSE,
  recurrence JSONB,
  participants UUID[] DEFAULT '{}',
  equipment JSONB DEFAULT '[]',
  reminders JSONB DEFAULT '[]',
  meet_link VARCHAR(500),
  meeting_type VARCHAR(20) DEFAULT 'in-person' CHECK (meeting_type IN ('in-person', 'online')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sample reservations table (for detailed sample equipment reservations)
CREATE TABLE sample_reservations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  production_number VARCHAR(10) NOT NULL,
  product_code VARCHAR(30) NOT NULL,
  quantity INTEGER NOT NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  order_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leave requests table
CREATE TABLE leave_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('vacation', 'late', 'early')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approvers JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_schedules_start_time ON schedules(start_time);
CREATE INDEX idx_schedules_end_time ON schedules(end_time);
CREATE INDEX idx_schedules_created_by ON schedules(created_by);
CREATE INDEX idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_date ON leave_requests(date);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);

-- RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Basic policies (allow authenticated users to read/write)
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view all groups" ON groups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage groups" ON groups FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all rooms" ON rooms FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage rooms" ON rooms FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all vehicles" ON vehicles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage vehicles" ON vehicles FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all sample equipment" ON sample_equipment FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage sample equipment" ON sample_equipment FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all schedules" ON schedules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage schedules" ON schedules FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all sample reservations" ON sample_reservations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage sample reservations" ON sample_reservations FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all leave requests" ON leave_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage leave requests" ON leave_requests FOR ALL USING (auth.role() = 'authenticated');

-- Notification logs table
CREATE TABLE notification_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'push', 'sms')),
  metadata JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification preferences table
CREATE TABLE notification_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  -- 予定作成通知
  schedule_created_email BOOLEAN DEFAULT TRUE,
  schedule_created_push BOOLEAN DEFAULT TRUE,
  -- 予定更新通知
  schedule_updated_email BOOLEAN DEFAULT TRUE,
  schedule_updated_push BOOLEAN DEFAULT TRUE,
  -- 予定削除通知
  schedule_deleted_email BOOLEAN DEFAULT TRUE,
  schedule_deleted_push BOOLEAN DEFAULT FALSE,
  -- 予定リマインダー
  schedule_reminder_email BOOLEAN DEFAULT TRUE,
  schedule_reminder_push BOOLEAN DEFAULT TRUE,
  -- 休暇申請通知
  leave_request_created_email BOOLEAN DEFAULT TRUE,
  leave_request_created_push BOOLEAN DEFAULT TRUE,
  leave_request_approved_email BOOLEAN DEFAULT TRUE,
  leave_request_approved_push BOOLEAN DEFAULT TRUE,
  leave_request_rejected_email BOOLEAN DEFAULT TRUE,
  leave_request_rejected_push BOOLEAN DEFAULT TRUE,
  -- その他
  system_announcement_email BOOLEAN DEFAULT TRUE,
  system_announcement_push BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for notification_logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for notification_logs
CREATE POLICY "Users can view notification logs" ON notification_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage notification logs" ON notification_logs FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Policies for notification_preferences
CREATE POLICY "Users can view their own notification preferences" ON notification_preferences FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own notification preferences" ON notification_preferences FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert their own notification preferences" ON notification_preferences FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Service role can manage all notification preferences" ON notification_preferences FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Index for notification_preferences
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_sample_equipment_updated_at BEFORE UPDATE ON sample_equipment FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_sample_reservations_updated_at BEFORE UPDATE ON sample_reservations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
