-- heartssh950@gmail.comを管理者として設定

-- 1. 既存のユーザーを確認
SELECT id, email, name, role FROM users WHERE email = 'heartssh950@gmail.com';

-- 2. auth.usersテーブルからheartssh950@gmail.comのユーザーIDを取得
SELECT id, email FROM auth.users WHERE email = 'heartssh950@gmail.com';

-- 3. usersテーブルにheartssh950@gmail.comが存在しない場合は追加
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
  'HEART001', -- 社員番号
  COALESCE(au.raw_user_meta_data->>'full_name', 'Heart SSH') as name,
  'ハートSSH' as name_kana,
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
  AND au.email = 'heartssh950@gmail.com';

-- 4. 既存のユーザーの場合、管理者権限に更新
UPDATE users 
SET 
  role = 'admin',
  updated_at = NOW()
WHERE email = 'heartssh950@gmail.com';

-- 5. 設定結果を確認
SELECT id, email, name, role, department FROM users WHERE email = 'heartssh950@gmail.com';

-- 6. Google Meet URL作成時の権限確認用
-- terao.form@gmail.comも管理者として設定
UPDATE users 
SET 
  role = 'admin',
  updated_at = NOW()
WHERE email = 'terao.form@gmail.com';

-- 7. 最終確認
SELECT id, email, name, role, department FROM users WHERE email IN ('heartssh950@gmail.com', 'terao.form@gmail.com');
