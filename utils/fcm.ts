import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { supabase } from "../lib/supabase";
import { CONFIG as APP_CONFIG } from "../config";

const firebaseConfig = APP_CONFIG.FIREBASE_CONFIG;
let webApp: any = null;
let messaging: any = null;
const isNative = Capacitor.isNativePlatform();

export const initFCM = async (
    userId?: string,
    onForegroundMessage?: (title: string, body: string, data?: any) => void
) => {
    try {
        if (isNative) {
            console.log("🔔 FCM: Initializing Native Push for User:", userId || 'Guest');
            await initNativePush(userId, onForegroundMessage);
        } else {
            await initWebPush(userId, onForegroundMessage);
        }
    } catch (err) {
        console.error("❌ FCM: System initialization error:", err);
    }
};

const initNativePush = async (
    userId?: string,
    onForegroundMessage?: (title: string, body: string, data?: any) => void
) => {
    try {
        console.log("🔔 FCM: Initializing Native Push (Capacitor-Firebase)...");

        // 1. Create channels for Android 8.0+
        if (Capacitor.getPlatform() === 'android') {
            try {
                await FirebaseMessaging.createChannel({
                    id: 'ride_requests',
                    name: 'Ride & Order Requests',
                    description: 'Critical alerts for new rides and order updates',
                    importance: 5, // MAX importance = heads-up notification
                    visibility: 1, // PUBLIC
                    vibration: true,
                    lights: true,
                    lightColor: '#00E39A',
                    sound: 'cashregistersound',
                });
                await FirebaseMessaging.createChannel({
                    id: 'default',
                    name: 'General Notifications',
                    description: 'Updates and general information',
                    importance: 5, // HIGH - ensures banners show
                    visibility: 1, // PUBLIC
                    vibration: true,
                    sound: 'default',
                });
                console.log("✅ FCM: Android Channels created (ride_requests + default)");
            } catch (channelErr) {
                console.warn("⚠️ FCM: Channel creation warning:", channelErr);
            }
        }

        // 2. Check / request FCM permissions
        let permStatus = await FirebaseMessaging.checkPermissions();
        console.log("🔔 FCM: Current permission status:", permStatus.receive);
        if (permStatus.receive === 'prompt') {
            permStatus = await FirebaseMessaging.requestPermissions();
            console.log("🔔 FCM: Permission after request:", permStatus.receive);
        }
        if (permStatus.receive !== 'granted') {
            console.warn("⚠️ FCM: Push permission not granted:", permStatus.receive);
            return;
        }

        // 3. Register listeners (remove old ones first to avoid duplicates)
        await FirebaseMessaging.removeAllListeners();

        // Foreground notification received - plugin auto-shows banner via notification_foreground flag
        FirebaseMessaging.addListener('notificationReceived', (event) => {
            console.log('🔔 FCM: Foreground notification received:', JSON.stringify(event.notification));
            const title = event.notification?.title || 'Notification';
            const body = event.notification?.body || '';
            const data = event.notification?.data as Record<string, any> | undefined;

            // Play sound for ride requests
            if (data?.ride_id || title.includes('Request')) {
                playNotificationSound();
            }

            if (onForegroundMessage) {
                onForegroundMessage(title, body, data);
            }
        });

        // When user taps on a notification
        FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
            console.log('🔔 FCM: Notification tapped:', event.notification?.title);
        });

        // 4. Get and sync the FCM token
        console.log("📡 FCM: Getting device token...");
        const result = await FirebaseMessaging.getToken();
        if (result.token) {
            console.log('✅ FCM: Token retrieved:', result.token.substring(0, 30) + '...');
            if (userId) {
                await syncFCMTokenToSupabase(userId, result.token);
            }
        } else {
            console.warn("⚠️ FCM: getToken() returned no token");
        }

        console.log("✅ FCM: Native initialization complete");

    } catch (err) {
        console.error("❌ FCM: Native init error:", err);
    }
};

const initWebPush = async (
    userId?: string,
    onForegroundMessage?: (title: string, body: string, data?: any) => void
) => {
    try {
        if (!APP_CONFIG.FIREBASE_CONFIG.apiKey) {
            console.warn("⚠️ FCM: Firebase config missing. Skipping web init.");
            return;
        }
        if (typeof Notification === 'undefined') {
            console.warn("⚠️ FCM: Notification API not available in this browser.");
            return;
        }
        if (Notification.permission === 'denied') {
            console.warn("⚠️ FCM: Web notifications are blocked by the browser.");
            return;
        }
        if (Notification.permission !== 'granted') {
            console.warn("⚠️ FCM: Notification permission not granted yet. Skipping token generation.");
            return;
        }

        if (!APP_CONFIG.FCM_VAPID_KEY) {
            console.warn("⚠️ FCM: VITE_FCM_VAPID_KEY is not set. Web push token cannot be obtained.");
            return;
        }

        if (!webApp) {
            webApp = initializeApp(firebaseConfig);
            messaging = getMessaging(webApp);
        }

        // Register the service worker
        let swReg: ServiceWorkerRegistration | undefined;
        try {
            swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;
            console.log("✅ FCM: Service Worker registered:", swReg.scope);
        } catch (swErr) {
            console.warn("⚠️ FCM: Service Worker registration failed:", swErr);
        }

        const token = await getToken(messaging, {
            vapidKey: APP_CONFIG.FCM_VAPID_KEY,
            serviceWorkerRegistration: swReg
        });

        if (token) {
            console.log("✅ FCM: Web token:", token.substring(0, 30) + '...');
            if (userId) await syncFCMTokenToSupabase(userId, token);
        } else {
            console.warn("⚠️ FCM: No web token returned — check VAPID key and service worker");
        }

        // Foreground messages on web
        onMessage(messaging, (payload) => {
            console.log("🔔 FCM: Web foreground message:", payload);
            const title = payload.notification?.title || payload.data?.notification_title || 'DROPOFF Partner';
            const body = payload.notification?.body || payload.data?.notification_body || '';
            const data = payload.data;

            if (data?.ride_id || title.includes('Request')) {
                playNotificationSound();
            }

            if (onForegroundMessage) {
                onForegroundMessage(title, body, data);
            }

            if (Notification.permission === 'granted') {
                const n = new Notification(title, {
                    body,
                    icon: '/assets/logo.png',
                    badge: '/assets/logo.png',
                    tag: data?.type || 'default',
                    data,
                });
                n.onclick = () => { window.focus(); n.close(); };
            }
        });

    } catch (err) {
        console.error("❌ FCM: Web init error:", err);
    }
};

const playNotificationSound = () => {
    try {
        const audio = new Audio('/assets/cashregistersound.mp3');
        audio.play().catch(err => console.error("🔊 Audio Playback Error:", err));
    } catch (e) {
        console.error("🔊 Audio System Error:", e);
    }
};

export const syncFCMTokenToSupabase = async (userId: string, token: string) => {
    try {
        if (!userId || !token) return;

        // Avoid redundant syncs if token hasn't changed
        const lastToken = localStorage.getItem('partner_last_fcm_sync_token');
        const lastUser = localStorage.getItem('partner_last_fcm_sync_user');
        if (lastToken === token && lastUser === userId) {
            console.log('📡 FCM: Token already synced, skipping.');
            return;
        }

        const { error } = await supabase
            .from('profiles')
            .update({ fcm_token: token, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            console.error('❌ FCM: Sync failed:', error);
        } else {
            console.log('✅ FCM: Token synced to Supabase');
            localStorage.setItem('partner_last_fcm_sync_token', token);
            localStorage.setItem('partner_last_fcm_sync_user', userId);
        }
    } catch (err) {
        console.error('❌ FCM: Sync exception:', err);
    }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) {
        console.error("❌ FCM: This browser does not support notifications.");
        return false;
    }
    try {
        const permission = await Notification.requestPermission();
        console.log("🔔 FCM: Permission status:", permission);
        return permission === "granted";
    } catch (err) {
        console.error("❌ FCM: Permission request error:", err);
        return false;
    }
};
