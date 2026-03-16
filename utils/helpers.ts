import { supabase } from '../lib/supabase';

export const sendPushNotification = async (title: string, message: string, target: 'driver' | 'customer' | 'merchant' = 'driver', userId?: string) => {
    console.log(`[PUSH] ${title}: ${message}`);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const finalUserId = userId || session?.user?.id;

        if (!finalUserId) {
            console.warn("⚠️ sendPushNotification: No user ID provided or found in session.");
            return;
        }

        const { data, error } = await supabase.functions.invoke('send-fcm-notification', {
            body: {
                userIds: [finalUserId],
                title,
                message,
                target
            }
        });

        if (error) throw error;
        console.log("✅ sendPushNotification: Edge function success:", data);
    } catch (err) {
        console.error("❌ sendPushNotification Error:", err);
    }
};
