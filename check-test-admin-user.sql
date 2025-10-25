-- test-admin@terao-f.co.jp の存在確認
SELECT id, email, role, name FROM users WHERE email = 'test-admin@terao-f.co.jp';

-- 全ユーザーのメールアドレス一覧
SELECT id, email, role, name FROM users ORDER BY email;