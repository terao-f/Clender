import { notificationService } from '../services/notificationService';
import { PushSubscriptionJSON } from '../types';

// Push Notification Configuration
const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Check if browser supports notifications
export function supportsNotifications(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!supportsNotifications()) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Register service worker and get push subscription
export async function registerPushNotification(userId: string): Promise<boolean> {
  try {
    if (!supportsNotifications()) {
      console.warn('Push notifications not supported');
      return false;
    }

    // Request permission first
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return false;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Subscribe to push notifications
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });
    }

    // Convert to JSON format
    const subscriptionJson: PushSubscriptionJSON = subscription.toJSON() as PushSubscriptionJSON;

    // Save subscription to backend
    const success = await notificationService.subscribeToPush(userId, subscriptionJson);
    
    if (success) {
      console.log('Push notification registered successfully');
      // Show test notification
      await showLocalNotification('通知が有効になりました', {
        body: 'スケジュールのリマインダーや更新情報を受け取ることができます。',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png'
      });
    }

    return success;
  } catch (error) {
    console.error('Error registering push notification:', error);
    return false;
  }
}

// Unregister push notifications
export async function unregisterPushNotification(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Remove subscription from backend
    const success = await notificationService.unsubscribeFromPush(userId);
    return success;
  } catch (error) {
    console.error('Error unregistering push notification:', error);
    return false;
  }
}

// Show local notification (for immediate notifications)
export async function showLocalNotification(
  title: string, 
  options?: NotificationOptions
): Promise<void> {
  if (!supportsNotifications()) return;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    ...options,
    timestamp: Date.now()
  });
}

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Handle notification click events
export function setupNotificationHandlers(): void {
  if (!supportsNotifications()) return;

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'notification-click') {
      handleNotificationClick(event.data);
    }
  });
}

// Handle different notification actions
function handleNotificationClick(data: any): void {
  const { action, notificationData } = data;

  switch (notificationData?.type) {
    case 'schedule_created':
    case 'schedule_updated':
    case 'schedule_reminder':
      // Navigate to calendar or specific schedule
      if (action === 'view' || action === 'join') {
        window.location.href = `/calendar?scheduleId=${notificationData.scheduleId}`;
      }
      break;
    
    case 'leave_request':
      // Navigate to leave requests
      window.location.href = '/leave-requests';
      break;
    
    default:
      // Default action - go to dashboard
      window.location.href = '/dashboard';
  }
}