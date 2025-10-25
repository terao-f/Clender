# Supabaseテーブルセットアップ手順

## 必要なテーブル
1. `user_google_tokens` - Googleアクセストークンを保存
2. `google_calendar_sync_settings` - 同期設定を保存
3. `schedule_google_event_mappings` - スケジュールとGoogleイベントのマッピング

## セットアップ方法

### 方法1: Supabaseダッシュボードから実行（推奨）

1. **Supabaseダッシュボードにアクセス**
   - https://app.supabase.com/
   - プロジェクトを選択

2. **SQL Editorを開く**
   - 左側メニューから「SQL Editor」をクリック

3. **SQLファイルを実行**
   - `supabase/migrations/create_google_tokens_table.sql` の内容をコピー
   - SQL Editorに貼り付け
   - 「Run」ボタンをクリック

### 方法2: Supabase CLIを使用

```bash
# Supabaseプロジェクトディレクトリで実行
supabase db push
```

## 確認方法

1. **テーブルが作成されたか確認**
   - Supabaseダッシュボード → Table Editor
   - 以下のテーブルが表示されるはず：
     - `user_google_tokens`
     - `google_calendar_sync_settings`
     - `schedule_google_event_mappings`

2. **RLSポリシーが設定されているか確認**
   - 各テーブルを選択
   - 「Policies」タブをクリック
   - 各CRUD操作のポリシーが設定されているはず

## トラブルシューティング

### エラー: relation "update_updated_at_column" does not exist
以下のSQL関数を先に作成してください：

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';
```

### エラー: 406 Not Acceptable
- テーブルが存在しない
- RLSポリシーが正しく設定されていない
- Supabaseのanon keyが正しくない

上記を確認してください。