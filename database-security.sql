-- Enhanced Row Level Security (RLS) Policies for Schedule Management System
-- This file contains comprehensive security policies based on user roles and permissions

-- Drop existing basic policies
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view all groups" ON groups;
DROP POLICY IF EXISTS "Users can manage groups" ON groups;
DROP POLICY IF EXISTS "Users can view all rooms" ON rooms;
DROP POLICY IF EXISTS "Users can manage rooms" ON rooms;
DROP POLICY IF EXISTS "Users can view all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can manage vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can view all sample equipment" ON sample_equipment;
DROP POLICY IF EXISTS "Users can manage sample equipment" ON sample_equipment;
DROP POLICY IF EXISTS "Users can view all schedules" ON schedules;
DROP POLICY IF EXISTS "Users can manage schedules" ON schedules;
DROP POLICY IF EXISTS "Users can view all sample reservations" ON sample_reservations;
DROP POLICY IF EXISTS "Users can manage sample reservations" ON sample_reservations;
DROP POLICY IF EXISTS "Users can view all leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Users can manage leave requests" ON leave_requests;

-- Helper function to get current user's role from authenticated user
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM users 
    WHERE id = auth.uid()::text;
    
    RETURN COALESCE(user_role, 'employee');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(required_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_role TEXT;
    role_hierarchy JSONB := '{"employee": 1, "admin": 2, "president": 3}';
BEGIN
    current_role := get_current_user_role();
    
    RETURN (role_hierarchy->>current_role)::int >= (role_hierarchy->>required_role)::int;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is in same department
CREATE OR REPLACE FUNCTION same_department(user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    current_dept TEXT;
    target_dept TEXT;
BEGIN
    SELECT department INTO current_dept FROM users WHERE id = auth.uid()::text;
    SELECT department INTO target_dept FROM users WHERE id = user_id;
    
    RETURN current_dept = target_dept;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit columns to all tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    changed_fields TEXT[];
    field_name TEXT;
BEGIN
    -- Skip audit for audit_logs table to prevent infinite loops
    IF TG_TABLE_NAME = 'audit_logs' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Prepare old and new data
    IF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        new_data := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        old_data := NULL;
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        
        -- Find changed fields
        changed_fields := ARRAY[]::TEXT[];
        FOR field_name IN SELECT key FROM jsonb_each(new_data) LOOP
            IF old_data->>field_name IS DISTINCT FROM new_data->>field_name THEN
                changed_fields := changed_fields || field_name;
            END IF;
        END LOOP;
    END IF;

    -- Insert audit record
    INSERT INTO audit_logs (
        table_name,
        operation,
        user_id,
        old_values,
        new_values,
        changed_fields,
        ip_address,
        user_agent
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        auth.uid(),
        old_data,
        new_data,
        changed_fields,
        inet_client_addr(),
        current_setting('request.headers', true)::jsonb->>'user-agent'
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for all main tables
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('audit_logs')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS audit_trigger ON %I;
            CREATE TRIGGER audit_trigger
                AFTER INSERT OR UPDATE OR DELETE ON %I
                FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
        ', table_record.tablename, table_record.tablename);
    END LOOP;
END $$;

-- USERS TABLE POLICIES
-- Presidents can do everything with users
CREATE POLICY "presidents_full_user_access" ON users 
    FOR ALL 
    USING (get_current_user_role() = 'president')
    WITH CHECK (get_current_user_role() = 'president');

-- Admins can view and modify employee accounts, but not other admins or presidents
CREATE POLICY "admins_manage_employees" ON users 
    FOR ALL 
    USING (
        get_current_user_role() = 'admin' AND 
        (role = 'employee' OR id = auth.uid()::text)
    )
    WITH CHECK (
        get_current_user_role() = 'admin' AND 
        (role = 'employee' OR id = auth.uid()::text)
    );

-- Employees can view users in same department and update own profile
CREATE POLICY "employees_view_department_users" ON users 
    FOR SELECT 
    USING (
        get_current_user_role() = 'employee' AND 
        (same_department(id) OR id = auth.uid()::text)
    );

CREATE POLICY "employees_update_own_profile" ON users 
    FOR UPDATE 
    USING (
        get_current_user_role() = 'employee' AND 
        id = auth.uid()::text
    )
    WITH CHECK (
        get_current_user_role() = 'employee' AND 
        id = auth.uid()::text AND
        role = OLD.role -- Prevent role elevation
    );

-- SCHEDULES TABLE POLICIES
-- Presidents can manage all schedules
CREATE POLICY "presidents_full_schedule_access" ON schedules 
    FOR ALL 
    USING (get_current_user_role() = 'president')
    WITH CHECK (get_current_user_role() = 'president');

-- Admins can manage all schedules
CREATE POLICY "admins_full_schedule_access" ON schedules 
    FOR ALL 
    USING (get_current_user_role() = 'admin')
    WITH CHECK (get_current_user_role() = 'admin');

-- Employees can view schedules they're involved in or department-relevant ones
CREATE POLICY "employees_view_relevant_schedules" ON schedules 
    FOR SELECT 
    USING (
        get_current_user_role() = 'employee' AND (
            created_by = auth.uid()::text OR 
            auth.uid()::text = ANY(participants) OR
            -- Add department-based visibility logic here
            EXISTS (
                SELECT 1 FROM users 
                WHERE id = auth.uid()::text 
                AND department IN (
                    SELECT u.department FROM users u 
                    WHERE u.id = schedules.created_by
                )
            )
        )
    );

-- Employees can create their own schedules
CREATE POLICY "employees_create_own_schedules" ON schedules 
    FOR INSERT 
    WITH CHECK (
        get_current_user_role() = 'employee' AND 
        created_by = auth.uid()::text
    );

-- Employees can update/delete only their own schedules
CREATE POLICY "employees_modify_own_schedules" ON schedules 
    FOR UPDATE 
    USING (
        get_current_user_role() = 'employee' AND 
        created_by = auth.uid()::text
    )
    WITH CHECK (
        get_current_user_role() = 'employee' AND 
        created_by = auth.uid()::text
    );

CREATE POLICY "employees_delete_own_schedules" ON schedules 
    FOR DELETE 
    USING (
        get_current_user_role() = 'employee' AND 
        created_by = auth.uid()::text
    );

-- LEAVE REQUESTS TABLE POLICIES
-- Presidents and admins can manage all leave requests
CREATE POLICY "admins_manage_all_leave_requests" ON leave_requests 
    FOR ALL 
    USING (user_has_permission('admin'))
    WITH CHECK (user_has_permission('admin'));

-- Employees can only manage their own leave requests
CREATE POLICY "employees_manage_own_leave_requests" ON leave_requests 
    FOR ALL 
    USING (
        get_current_user_role() = 'employee' AND 
        user_id = auth.uid()::text
    )
    WITH CHECK (
        get_current_user_role() = 'employee' AND 
        user_id = auth.uid()::text
    );

-- GROUPS TABLE POLICIES
-- Presidents can manage all groups
CREATE POLICY "presidents_manage_all_groups" ON groups 
    FOR ALL 
    USING (get_current_user_role() = 'president')
    WITH CHECK (get_current_user_role() = 'president');

-- Admins can manage groups
CREATE POLICY "admins_manage_groups" ON groups 
    FOR ALL 
    USING (get_current_user_role() = 'admin')
    WITH CHECK (get_current_user_role() = 'admin');

-- Employees can view groups they're members of
CREATE POLICY "employees_view_member_groups" ON groups 
    FOR SELECT 
    USING (
        get_current_user_role() = 'employee' AND 
        auth.uid()::text = ANY(members)
    );

-- EQUIPMENT TABLES POLICIES (rooms, vehicles, sample_equipment)
-- Admins and above can manage equipment
CREATE POLICY "admins_manage_rooms" ON rooms 
    FOR ALL 
    USING (user_has_permission('admin'))
    WITH CHECK (user_has_permission('admin'));

CREATE POLICY "employees_view_rooms" ON rooms 
    FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "admins_manage_vehicles" ON vehicles 
    FOR ALL 
    USING (user_has_permission('admin'))
    WITH CHECK (user_has_permission('admin'));

CREATE POLICY "employees_view_vehicles" ON vehicles 
    FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "admins_manage_sample_equipment" ON sample_equipment 
    FOR ALL 
    USING (user_has_permission('admin'))
    WITH CHECK (user_has_permission('admin'));

CREATE POLICY "employees_view_sample_equipment" ON sample_equipment 
    FOR SELECT 
    USING (auth.role() = 'authenticated');

-- SAMPLE RESERVATIONS TABLE POLICIES
-- Follow schedule permissions
CREATE POLICY "sample_reservations_follow_schedule_permissions" ON sample_reservations 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM schedules s 
            WHERE s.id = schedule_id AND (
                get_current_user_role() IN ('president', 'admin') OR
                s.created_by = auth.uid()::text OR
                auth.uid()::text = ANY(s.participants)
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM schedules s 
            WHERE s.id = schedule_id AND (
                get_current_user_role() IN ('president', 'admin') OR
                s.created_by = auth.uid()::text
            )
        )
    );

-- AUDIT LOGS POLICIES
-- Only presidents can view all audit logs
CREATE POLICY "presidents_view_all_audit_logs" ON audit_logs 
    FOR SELECT 
    USING (get_current_user_role() = 'president');

-- Admins can view audit logs for their actions and employee actions
CREATE POLICY "admins_view_relevant_audit_logs" ON audit_logs 
    FOR SELECT 
    USING (
        get_current_user_role() = 'admin' AND (
            user_id = auth.uid() OR
            user_id IN (
                SELECT id FROM users WHERE role = 'employee'
            )
        )
    );

-- No one can modify audit logs
CREATE POLICY "no_audit_log_modifications" ON audit_logs 
    FOR UPDATE 
    USING (false);

CREATE POLICY "no_audit_log_deletions" ON audit_logs 
    FOR DELETE 
    USING (false);

-- Security functions for application use

-- Function to check if user can access specific resource
CREATE OR REPLACE FUNCTION can_access_resource(
    resource_type TEXT,
    resource_id TEXT,
    action_type TEXT DEFAULT 'read'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_role TEXT;
    resource_owner TEXT;
BEGIN
    current_role := get_current_user_role();
    
    -- Presidents can access everything
    IF current_role = 'president' THEN
        RETURN TRUE;
    END IF;
    
    -- Get resource owner based on resource type
    CASE resource_type
        WHEN 'schedule' THEN
            SELECT created_by INTO resource_owner FROM schedules WHERE id = resource_id::uuid;
        WHEN 'leave_request' THEN
            SELECT user_id INTO resource_owner FROM leave_requests WHERE id = resource_id::uuid;
        WHEN 'user' THEN
            resource_owner := resource_id;
        ELSE
            RETURN FALSE;
    END CASE;
    
    -- Admins can access most resources
    IF current_role = 'admin' THEN
        CASE resource_type
            WHEN 'user' THEN
                -- Admins can't modify other admins or presidents
                RETURN action_type = 'read' OR 
                       resource_owner = auth.uid()::text OR
                       (SELECT role FROM users WHERE id = resource_owner) = 'employee';
            ELSE
                RETURN TRUE;
        END CASE;
    END IF;
    
    -- Employees can only access their own resources
    IF current_role = 'employee' THEN
        RETURN resource_owner = auth.uid()::text;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    event_type TEXT,
    event_action TEXT,
    resource_type TEXT DEFAULT NULL,
    resource_id TEXT DEFAULT NULL,
    severity TEXT DEFAULT 'low',
    details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        table_name,
        operation,
        user_id,
        new_values,
        ip_address,
        user_agent
    ) VALUES (
        'security_events',
        'LOG',
        auth.uid(),
        jsonb_build_object(
            'event_type', event_type,
            'action', event_action,
            'resource_type', resource_type,
            'resource_id', resource_id,
            'severity', severity,
            'details', details
        ),
        inet_client_addr(),
        current_setting('request.headers', true)::jsonb->>'user-agent'
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);

-- Create function to clean old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Only allow presidents to cleanup audit logs
    IF get_current_user_role() != 'president' THEN
        RAISE EXCEPTION 'Access denied: Only presidents can cleanup audit logs';
    END IF;
    
    DELETE FROM audit_logs 
    WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup action
    PERFORM log_security_event(
        'admin_action',
        'Cleaned up old audit logs',
        'audit_logs',
        NULL,
        'medium',
        jsonb_build_object('deleted_count', deleted_count, 'retention_days', retention_days)
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable real-time for security-relevant tables (if using Supabase)
-- This allows for real-time security monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE users;