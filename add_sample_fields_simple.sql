-- サンプル予約用のカラムを追加（簡易版）
-- このSQLをSupabaseのSQL Editorで実行してください

-- production_numberカラムを追加
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS production_number VARCHAR(50);

-- product_codeカラムを追加
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);