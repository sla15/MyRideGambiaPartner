import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "../lib/supabase";
import { CONFIG as APP_CONFIG } from "../config";
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const firebaseConfig = APP_CONFIG.FIREBASE_CONFIG;
const app = initializeApp(firebaseConfig);

// Web-only: messaging instance
let messaging: any;
try {
    if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
        messaging = getMessaging(app);
    }
} catch (e) {
    console.warn("FCM: Messaging not initialized (likely platform restriction)");
}

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

export const initFCM = async (userId?: string, onForegroundMessage?: (title: string, body: string, data?: any) => void) => {
    try {
        console.log("🔔 FCM: Starting initialization for user:", userId || "anonymous");

        if (Capacitor.isNativePlatform()) {
            await initNativePush(userId, onForegroundMessage);
        } else {
            await initWebPush(userId, onForegroundMessage);
        }
    } catch (err) {
        console.error("❌ FCM: Initialization error details:", err);
    }
};

const initNativePush = async (userId?: string, onForegroundMessage?: (title: string, body: string, data?: any) => void) => {
    console.log("🔔 FCM: Initializing Native Push (Capacitor)");

    // 1. Create Channels for Android 8.0+
    if (Capacitor.getPlatform() === 'android') {
        try {
            await PushNotifications.createChannel({
                id: 'ride_requests',
                name: 'Ride & Order Requests',
                description: 'Critical alerts for new rides and order updates',
                importance: 5, // Importance.HIGH
                visibility: 1, // Visibility.PUBLIC
                vibration: true,
                lights: true,
                lightColor: '#00E39A',
                sound: 'cashregistersound' 
            });

            await PushNotifications.createChannel({
                id: 'default',
                name: 'General Notifications',
                description: 'Updates and general information',
                importance: 3, // Importance.DEFAULT
                visibility: 1,
                vibration: true
            });
            console.log("✅ FCM: Android Channels created");
        } catch (e) {
            console.warn("⚠️ FCM: Failed to create channels:", e);
        }
    }

    // 2. Check Permissions
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
        console.warn("⚠️ FCM: Native push permissions not granted. Status:", permStatus.receive);
        return;
    }

    // 3. Attach listeners BEFORE registration
    PushNotifications.addListener('registration', async (token) => {
        console.log('✅ FCM: Native registration successful. Token:', token.value.substring(0, 10) + "...");
        if (userId) {
            await syncFCMTokenToSupabase(userId, token.value);
        }
    });

    PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ FCM: Native registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('🔔 FCM: Native notification received:', notification);
        if (onForegroundMessage) {
            onForegroundMessage(notification.title || 'Notification', notification.body || '', notification.data);
        }
        if (notification.data?.ride_id || notification.title?.includes('Request')) {
            playNotificationSound();
        }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('🔔 FCM: Native notification action performed:', notification);
    });

    // 4. Register for remote notifications
    await PushNotifications.register();

};

const initWebPush = async (userId?: string, onForegroundMessage?: (title: string, body: string, data?: any) => void) => {
    if (!("Notification" in window)) {
        console.error("❌ FCM: This browser does not support notifications.");
        return;
    }

    if (Notification.permission !== "granted") {
        console.warn("⚠️ FCM: Notification permission not granted yet. Skipping token generation.");
        return;
    }

    if (!messaging) return;

    try {
        const token = await getToken(messaging, {
            vapidKey: APP_CONFIG.FCM_VAPID_KEY
        });

        if (token) {
            console.log("✅ FCM: Web token generated.");
            if (userId) await syncFCMTokenToSupabase(userId, token);
        }

        onMessage(messaging, (payload) => {
            console.log("🔔 FCM: Web message received in foreground:", payload);

            const title = payload.notification?.title || 'New Notification';
            const body = payload.notification?.body || '';

            if (payload.data?.ride_id || title.includes('Request')) {
                playNotificationSound();
            }

            if (onForegroundMessage) {
                onForegroundMessage(title, body, payload.data);
            }

            if (payload.notification) {
                try {
                    const notificationTitle = title;
                    const notificationOptions = {
                        body: body,
                        icon: '/assets/logo.png',
                        data: payload.data,
                        tag: payload.data?.ride_id || 'general'
                    };
                    const notification = new Notification(notificationTitle, notificationOptions);
                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                    };
                } catch (err) {
                    console.warn("⚠️ FCM: Could not show browser notification in foreground:", err);
                }
            }
        });
    } catch (err) {
        console.error("❌ FCM: Web push registration failed:", err);
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
    const { error } = await supabase
        .from('profiles')
        .update({
            fcm_token: token,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    if (error) console.error('❌ FCM: Sync failed:', error);
    else console.log('✅ FCM: Token synced to Supabase');
};
