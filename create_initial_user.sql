-- auth.usersに存在するユーザーをusersテーブルに追加
INSERT INTO users (
  id,
  employee_id,
  name,
  name_kana,
  email,
  phone,
  department,
  role,
  default_work_days,
  created_at,
  updated_at
)
SELECT 
  au.id,
  'EMP001', -- 仮の社員番号
  COALESCE(au.raw_user_meta_data->>'full_name', 'テストユーザー') as name,
  'テストユーザー' as name_kana,
  au.email,
  '090-0000-0000' as phone,
  'システム部' as department,
  'admin' as role, -- 管理者権限を付与
  '[1,2,3,4,5]'::jsonb as default_work_days, -- 月〜金
  au.created_at,
  au.created_at as updated_at
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE u.id IS NULL
  AND au.email = 'k.sho626626@gmail.com';

-- 作成されたユーザーを確認
SELECT * FROM users WHERE email = 'k.sho626626@gmail.com';