import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    
    console.log('=== Save Notification Log Function ===');
    console.log('Request body:', requestBody);
    
    // Insert notification log
    const { data, error } = await supabase
      .from('notification_logs')
      .insert({
        user_id: requestBody.user_id,
        type: requestBody.type,
        category: requestBody.category,
        subject: requestBody.subject,
        content: requestBody.content,
        metadata: requestBody.metadata || {},
        status: requestBody.status,
        error_message: requestBody.error_message,
        sent_at: requestBody.sent_at
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Notification log saved successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in save-notification-log function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});