/**
 * Web Push (VAPID) subscription helpers for OS-level push notifications.
 * Provides utilities to subscribe/unsubscribe users to push notifications.
 * Gracefully degrades if browser doesn't support Push API.
 */

(function initPushSubscription() {
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && isSecure;

  if (!isSupported) {
    console.log('[Push] Browser does not support Web Push');
    window.makitPush = {
      subscribe: () => Promise.reject(new Error('웹 푸시가 지원되지 않습니다')),
      unsubscribe: () => Promise.reject(new Error('웹 푸시가 지원되지 않습니다')),
      status: () => ({ permission: 'denied', hasSubscription: false, supported: false }),
      isSupported: false,
    };
    return;
  }

  /**
   * Convert base64 VAPID public key to Uint8Array for subscription
   */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Get VAPID public key from backend
   */
  async function getVapidKey() {
    try {
      const response = await fetch('/api/notifications/push/vapid-key');
      if (!response.ok) {
        console.warn('[Push] VAPID key endpoint returned', response.status);
        return null;
      }
      const data = await response.json();
      return data.publicKey;
    } catch (e) {
      console.error('[Push] Failed to fetch VAPID key:', e);
      return null;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async function subscribeToPush() {
    try {
      // Check permission first
      const permission = Notification.permission;
      if (permission === 'denied') {
        console.warn('[Push] Notification permission denied by user');
        return { error: 'permission_denied', message: '브라우저 푸시 알림 권한이 거부되었습니다' };
      }

      // Request permission if needed
      if (permission !== 'granted') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          console.warn('[Push] User denied notification permission');
          return { error: 'permission_denied', message: '브라우저 푸시 알림 권한이 거부되었습니다' };
        }
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      if (!registration) {
        console.error('[Push] Service worker not ready');
        return { error: 'sw_unavailable', message: '서비스 워커를 사용할 수 없습니다' };
      }

      // Get VAPID key
      const publicKey = await getVapidKey();
      if (!publicKey) {
        console.warn('[Push] VAPID key not available (push disabled on server)');
        return { error: 'push_disabled', message: '푸시 알림이 서버에서 비활성화되었습니다' };
      }

      // Subscribe to push manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      console.log('[Push] Subscription successful');

      // Send subscription to backend
      const subscriptionJson = subscription.toJSON();
      const response = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscriptionJson.endpoint,
          keys: subscriptionJson.keys,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Push] Backend rejected subscription:', errorData);
        // Unsubscribe locally since backend rejected
        await subscription.unsubscribe();
        return { error: 'backend_error', message: errorData.message || '구독 등록에 실패했습니다' };
      }

      const result = await response.json();
      console.log('[Push] Subscription registered with backend:', result);
      return { success: true, message: result.message };
    } catch (e) {
      console.error('[Push] Subscription failed:', e);
      return { error: 'subscribe_error', message: e.message };
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async function unsubscribeFromPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration) {
        console.warn('[Push] Service worker not available');
        return { error: 'sw_unavailable' };
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        console.log('[Push] No subscription found');
        return { success: true, message: '이미 구독이 해제되었습니다' };
      }

      // Notify backend to delete subscription
      const endpoint = subscription.endpoint;
      const response = await fetch('/api/notifications/push/unsubscribe?endpoint=' + encodeURIComponent(endpoint), {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.error('[Push] Backend unsubscribe failed:', response.status);
      }

      // Unsubscribe locally
      await subscription.unsubscribe();
      console.log('[Push] Unsubscribed successfully');
      return { success: true, message: '푸시 알림이 비활성화되었습니다' };
    } catch (e) {
      console.error('[Push] Unsubscribe error:', e);
      return { error: 'unsubscribe_error', message: e.message };
    }
  }

  /**
   * Get current subscription status
   */
  async function getCurrentSubscriptionStatus() {
    try {
      const permission = Notification.permission;
      const registration = await navigator.serviceWorker.ready;
      const subscription = registration ? await registration.pushManager.getSubscription() : null;

      return {
        permission: permission,
        hasSubscription: !!subscription,
        supported: true,
      };
    } catch (e) {
      console.warn('[Push] Error checking status:', e);
      return {
        permission: Notification.permission || 'default',
        hasSubscription: false,
        supported: true,
      };
    }
  }

  /**
   * Global API
   */
  window.makitPush = {
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush,
    status: getCurrentSubscriptionStatus,
    isSupported: true,
  };

  console.log('[Push] Web Push API initialized');
})();
