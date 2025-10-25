// Service Worker for Push Notifications

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('Push event but no data');
    return;
  }

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    tag: data.tag || 'default',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    timestamp: data.timestamp || Date.now(),
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const action = event.action;

  // Send message to all clients
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's already a window open, focus it and send the message
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'notification-click',
            action: action,
            notificationData: notificationData
          });
          return;
        }
      }

      // If no window is open, open a new one
      if (clients.openWindow) {
        let url = '/';
        
        // Determine URL based on notification type
        switch (notificationData.type) {
          case 'schedule_created':
          case 'schedule_updated':
          case 'schedule_reminder':
            url = `/calendar?scheduleId=${notificationData.scheduleId}`;
            break;
          case 'leave_request':
            url = '/leave-requests';
            break;
          default:
            url = '/dashboard';
        }

        return clients.openWindow(url);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed', event.notification.tag);
});

// Periodic background sync for checking scheduled notifications
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-scheduled-notifications') {
    event.waitUntil(checkScheduledNotifications());
  }
});

async function checkScheduledNotifications() {
  // This would typically check with your backend for any scheduled notifications
  // For now, we'll just log
  console.log('Checking for scheduled notifications...');
}