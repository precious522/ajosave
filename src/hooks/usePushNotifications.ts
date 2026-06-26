import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type Token,
  type ActionPerformed,
  type PushNotificationSchema,
} from '@capacitor/push-notifications';

/**
 * Registers the device for push notifications on native iOS/Android.
 * No-op on web. Call this hook once at the app root after the user is authenticated.
 *
 * @param onToken - Callback with the FCM/APNs device token (persist to your backend)
 */
export function usePushNotifications(onToken?: (token: string) => void) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const register = async () => {
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') return;
      await PushNotifications.register();
    };

    const tokenListener = PushNotifications.addListener(
      'registration',
      (token: Token) => onToken?.(token.value),
    );

    const errorListener = PushNotifications.addListener(
      'registrationError',
      (err) => console.error('Push registration error:', err),
    );

    const notificationListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push received:', notification);
      },
    );

    const actionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('Push action:', action);
      },
    );

    register();

    return () => {
      tokenListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
      notificationListener.then((l) => l.remove());
      actionListener.then((l) => l.remove());
    };
  }, [onToken]);
}
