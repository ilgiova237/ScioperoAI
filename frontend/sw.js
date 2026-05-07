self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const title = data.title || 'ScioperoScan AI';
    const options = {
        body: data.body || 'Nuova notifica',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});