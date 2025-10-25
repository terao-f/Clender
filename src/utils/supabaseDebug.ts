import { supabase } from '../lib/supabase';

export async function debugSupabaseRequest(
  table: string, 
  operation: 'insert' | 'update' | 'delete',
  data: any
) {
  console.group(`🔍 Supabase ${operation} on ${table}`);
  console.log('Request data:', data);
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Current user:', user?.id, user?.email);
    
    if (authError) {
      console.error('Auth error:', authError);
    }
    
    // Check table RLS status
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('get_table_rls_status', { table_name: table });
    
    console.log('RLS status:', rlsStatus);
    
    if (rlsError) {
      console.warn('RLS check error:', rlsError);
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  }
  
  console.groupEnd();
}

// デバッグ用のインターセプター
export function setupSupabaseDebugger() {
  // Supabaseのリクエストをインターセプト
  const originalFrom = supabase.from.bind(supabase);
  
  (supabase as any).from = function(table: string) {
    const result = originalFrom(table);
    const originalInsert = result.insert?.bind(result);
    
    if (originalInsert) {
      result.insert = function(values: any, options?: any) {
        console.log(`📤 Supabase INSERT to ${table}:`, values);
        return originalInsert(values, options);
      };
    }
    
    return result;
  };
}