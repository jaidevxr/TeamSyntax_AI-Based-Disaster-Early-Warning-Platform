// Push Notification utilities for emergency alerts

export const isPushSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isPushSupported()) return 'unsupported';
  
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return 'denied';
  }
};

interface EmergencyNotification {
  title: string;
  body: string;
  type: string;
  severity: string;
  confidence: number;
}

export const sendEmergencyNotification = async (alert: EmergencyNotification): Promise<boolean> => {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    
    const severityEmoji: Record<string, string> = {
      emergency: '🚨',
      warning: '⚠️',
      watch: '👀',
      advisory: 'ℹ️',
    };

    const typeEmoji: Record<string, string> = {
      flood: '🌊',
      earthquake: '🔴',
      heatwave: '🔥',
      cold_wave: '🥶',
      cyclone: '🌀',
      thunderstorm: '⛈️',
      extreme_weather: '💨',
    };

    const emoji = typeEmoji[alert.type] || severityEmoji[alert.severity] || '⚠️';

    const options: any = {
      body: alert.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: `emergency-${alert.type}-${Date.now()}`,
      requireInteraction: alert.severity === 'emergency',
      vibrate: alert.severity === 'emergency' 
        ? [300, 100, 300, 100, 300] 
        : [200, 100, 200],
      data: { url: '/dashboard', type: alert.type, severity: alert.severity },
      actions: [
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    await registration.showNotification(
      `${emoji} ${alert.title}`,
      options
    );

    return true;
  } catch (err) {
    console.error('Failed to send notification:', err);
    // Fallback to basic Notification API
    try {
      new Notification(`🚨 ${alert.title}`, {
        body: alert.body,
        icon: '/icon-192x192.png',
        tag: `emergency-${alert.type}`,
      });
      return true;
    } catch {
      return false;
    }
  }
};

// Track which alerts we've already notified about to avoid duplicates
const notifiedAlertIds = new Set<string>();

export const shouldNotify = (alertId: string): boolean => {
  if (notifiedAlertIds.has(alertId)) return false;
  notifiedAlertIds.add(alertId);
  
  // Clean up old entries (keep last 100)
  if (notifiedAlertIds.size > 100) {
    const entries = Array.from(notifiedAlertIds);
    entries.slice(0, entries.length - 100).forEach(id => notifiedAlertIds.delete(id));
  }
  
  return true;
};
