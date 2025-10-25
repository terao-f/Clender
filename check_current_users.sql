-- 現在のユーザー一覧とロールを確認
SELECT id, email, role, name FROM users WHERE email IN ('heartssh950@gmail.com', 'terao.form@gmail.com') ORDER BY email;

-- 管理者ロールのユーザー一覧
SELECT id, email, role, name FROM users WHERE role = 'admin' ORDER BY email;

-- 全ユーザー一覧（最初の10件）
SELECT id, email, role, name FROM users LIMIT 10;
