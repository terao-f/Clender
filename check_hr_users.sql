-- 1. is_hrカラムが存在するか確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'is_hr';

-- 2. 人事フラグがtrueのユーザーを確認
SELECT id, name, email, role, is_hr
FROM users
WHERE is_hr = true;

-- 3. 全ユーザーのis_hrフラグの状態を確認
SELECT name, email, role, is_hr
FROM users
ORDER BY is_hr DESC, name;