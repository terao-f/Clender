-- heartssh950@gmail.comの管理者権限を確認

-- 1. usersテーブルでheartssh950@gmail.comの権限を確認
SELECT id, email, name, role, department FROM users WHERE email = 'heartssh950@gmail.com';

-- 2. auth.usersテーブルでheartssh950@gmail.comが存在するか確認
SELECT id, email FROM auth.users WHERE email = 'heartssh950@gmail.com';

-- 3. 管理者権限を持つ全ユーザーを確認
SELECT id, email, name, role FROM users WHERE role = 'admin';

-- 4. 最新のGoogle Meet URL作成ログを確認（もしあれば）
-- これは実際のログテーブルがある場合のみ
