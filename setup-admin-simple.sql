-- heartssh950@gmail.com を管理者として設定（簡単版）
-- このスクリプトをSupabaseのSQL Editorで実行してください

-- 既存のユーザーを管理者に更新（存在する場合）
UPDATE users 
SET role = 'admin' 
WHERE email = 'heartssh950@gmail.com';

-- ユーザーが存在しない場合は新規作成
INSERT INTO users (id, employee_id, name, name_kana, email, phone, department, role, default_work_days)
VALUES (
  gen_random_uuid(),
  'ADMIN002',
  'テスト管理者',
  'テストカンリシャ',
  'heartssh950@gmail.com',
  '090-1111-2222',
  'システム部',
  'admin',
  '[1,2,3,4,5]'::jsonb
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin';

-- terao.form@gmail.com も管理者として設定
UPDATE users 
SET role = 'admin' 
WHERE email = 'terao.form@gmail.com';

INSERT INTO users (id, employee_id, name, name_kana, email, phone, department, role, default_work_days)
VALUES (
  gen_random_uuid(),
  'ADMIN003',
  'Terao Form',
  'テラオフォーム',
  'terao.form@gmail.com',
  '090-3333-4444',
  'システム部',
  'admin',
  '[1,2,3,4,5]'::jsonb
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin';

-- 結果を確認
SELECT id, email, role, name FROM users WHERE email IN ('heartssh950@gmail.com', 'terao.form@gmail.com');
