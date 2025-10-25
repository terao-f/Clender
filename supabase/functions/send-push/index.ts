import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Import web-push for sending push notifications
import webpush from "https://esm.sh/web-push@3.6.7";

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
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@company.com';

    // For development/testing
    const isDevelopment = !vapidPublicKey || !vapidPrivateKey;

    const { subscription, notification } = await req.json();

    if (!subscription || !notification) {
      throw new Error('Missing subscription or notification data');
    }

    if (isDevelopment) {
      // In development, just log the push notification
      console.log('=== Push Notification Debug ===');
      console.log('Subscription:', subscription);
      console.log('Notification:', notification);
      console.log('==============================');
      
      return new Response(
        JSON.stringify({ success: true }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Set VAPID details
    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    // Prepare notification payload
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icon-192x192.png',
      badge: notification.badge || '/badge-72x72.png',
      tag: notification.tag,
      data: notification.data || {},
      requireInteraction: notification.requireInteraction || false,
      actions: notification.actions || [],
      timestamp: Date.now(),
    });

    // Send the notification
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      // Handle specific errors
      if (error.statusCode === 410) {
        // Subscription has expired or is no longer valid
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Subscription expired',
            shouldRemove: true 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 410 
          }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in send-push function:', error);
    
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