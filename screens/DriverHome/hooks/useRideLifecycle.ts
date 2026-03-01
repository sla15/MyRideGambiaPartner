
import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

export const useRideLifecycle = (
    user: any,
    profile: any,
    currentRide: any,
    setCurrentRide: (ride: any) => void,
    rideStatus: string,
    setRideStatus: (status: string) => void,
    incomingRides: any[],
    setIncomingRides: (rides: any[]) => void,
    rejectedRideIds: Set<string>,
    setRejectedRideIds: (ids: any) => void,
    pushNotification: any,
    showAlert: (title: string, message: string, onConfirm?: () => void) => void,
    setShowRatingModal: (val: boolean) => void,
    setHasCollectedPayment: (val: boolean) => void,
    setUserRating: (val: number) => void,
    userRating: number,
    setIsDrawerExpanded: (val: boolean) => void,
    appSettings: any,
    syncProfile: () => Promise<void>,
    countdown: number,
    setCountdown: (val: any) => void,
    calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number
) => {
    const ringingInterval = useRef<any>(null);

    const notifyCustomer = async (title: string, message: string) => {
        if (!currentRide?.customer_id) return;
        try {
            const { data: customerProfile } = await supabase
                .from('profiles')
                .select('fcm_token')
                .eq('id', currentRide.customer_id)
                .single();

            if (customerProfile?.fcm_token) {
                await supabase.functions.invoke('send-fcm-notification', {
                    body: {
                        tokens: [customerProfile.fcm_token],
                        title,
                        message,
                        target: 'customer',
                        data: { ride_id: currentRide.id }
                    }
                });
            }
        } catch (e) {
            console.error("Error notifying customer with FCM:", e);
        }
    };

    const handleAcceptRide = async () => {
        if (!currentRide || !user) return;

        // Optimistically mark as accepted in UI only AFTER db confirms it
        // .select('id') returns the updated rows — if empty, the ride was already taken/cancelled
        const { data: updatedRows, error } = await supabase
            .from('rides')
            .update({ status: 'accepted', driver_id: user.id })
            .eq('id', currentRide.id)
            .eq('status', 'searching') // Only update if still searching (race-safe)
            .select('id');

        if (error || !updatedRows || updatedRows.length === 0) {
            // Ride was already taken by another driver or customer cancelled
            console.warn("[handleAcceptRide] Ride unavailable (no rows updated or error):", error);
            showAlert('Ride Unavailable', 'This request has already been taken by another driver or was cancelled.');

            // Remove stale ride from the queue and show the next one
            const remaining = incomingRides.filter(r => r.id !== currentRide.id);
            setIncomingRides(remaining);
            if (remaining.length === 0) {
                setCurrentRide(null);
                setRideStatus('IDLE');
                setIsDrawerExpanded(false);
            } else {
                setCurrentRide(remaining[0]);
                setRideStatus('RINGING');
                setCountdown(20);
            }
            return;
        }

        // DB confirmed — now update local UI state
        setRideStatus('ACCEPTED');

        // REJECT ALL OTHER PENDING REQUESTS IN QUEUE
        const otherRideIds = incomingRides.filter(r => r.id !== currentRide.id).map(r => r.id);
        if (otherRideIds.length > 0) {
            setRejectedRideIds((prev: Set<string>) => {
                const newSet = new Set(prev);
                otherRideIds.forEach(id => newSet.add(id));
                return newSet;
            });
        }

        pushNotification('Ride Accepted', `Navigating to pickup`, 'SYSTEM');
        setIncomingRides([]); // Clear the queue since we accepted one
    };

    const handleArrivedAtPickup = async () => {
        if (!currentRide) return;
        setRideStatus('ARRIVED');
        await supabase.from('rides').update({ status: 'arrived' }).eq('id', currentRide.id);
        pushNotification('You have Arrived', 'Notify the passenger you are here.', 'SYSTEM');
        notifyCustomer('Driver Arrived', 'Your driver has arrived at the pickup location!');
    };

    const handleStartRide = async () => {
        if (!currentRide) return;
        setRideStatus('NAVIGATING');
        setIsDrawerExpanded(false);
        await supabase.from('rides').update({ status: 'in-progress' }).eq('id', currentRide.id);
        pushNotification('Ride Started', 'Destination revealed. Drive safely!', 'RIDE');
        notifyCustomer('Trip Started', 'Your driver has started the trip. Enjoy the ride!');
        if (user && !profile.isOnline) {
            await supabase.from('drivers').update({ is_online: true }).eq('id', user.id);
        }
    };

    const handleCompleteRide = async (isAuto = false) => {
        if (!currentRide || !user) return;
        try {
            setRideStatus('COMPLETED');
            setIsDrawerExpanded(true);
            const { data, error } = await supabase.rpc('complete_ride', {
                p_ride_id: currentRide.id,
                p_driver_id: user.id,
                p_actual_lat: profile.currentLat || 0,
                p_actual_lng: profile.currentLng || 0,
                p_is_auto: isAuto
            });
            if (error) throw error;
            if (!data.success) throw new Error(data.error);

            setCurrentRide(prev => prev ? { ...prev, price: data.final_price } : null);

            if (data.final_price > 0) {
                notifyCustomer('Trip Completed', 'You have arrived at your destination. Thank you for riding!');
                pushNotification('Ride Completed', `Total: ${appSettings.currency_symbol}${data.final_price}`, 'RIDE');
            } else {
                notifyCustomer('Ride Cancelled', 'The ride was ended with zero movement.');
                pushNotification('Ride Ended', 'No movement detected. Ride cancelled.', 'SYSTEM');
                setRideStatus('IDLE');
                setCurrentRide(null);
                setIsDrawerExpanded(false);
                return;
            }
            await syncProfile();
        } catch (e: any) {
            console.error("Error completing ride via RPC:", e);
            pushNotification('Error', e.message || 'Failed to complete ride properly.', 'SYSTEM');
        }
    };

    const submitRating = async () => {
        if (currentRide && user) {
            if (userRating > 0) {
                try {
                    await supabase.from('reviews').insert({
                        ride_id: currentRide.id,
                        reviewer_id: user.id,
                        target_id: currentRide.customer_id,
                        rating: userRating,
                        role_target: 'CUSTOMER'
                    });
                } catch (err) {
                    console.error("Error saving rating:", err);
                }
            }
        }
        setCurrentRide(null);
        setIncomingRides([]);
        setRideStatus('IDLE');
        setIsDrawerExpanded(false);
        setShowRatingModal(false);
        setHasCollectedPayment(false);
        setUserRating(0);
    };

    const handleSkipRating = () => {
        setCurrentRide(null);
        setIncomingRides([]);
        setRideStatus('IDLE');
        setIsDrawerExpanded(false);
        setShowRatingModal(false);
        setHasCollectedPayment(false);
        setUserRating(0);
    };

    // NEW: Handle declining a single ride from the stack
    const handleDeclineRide = () => {
        if (!currentRide) return;

        setRejectedRideIds((prev: Set<string>) => new Set(prev).add(currentRide.id));

        // Remove from local queue
        const remaining = incomingRides.filter(r => r.id !== currentRide.id);
        setIncomingRides(remaining);

        if (remaining.length === 0) {
            setCurrentRide(null);
            setRideStatus('IDLE');
        } else {
            // Show the NEXT one in queue (FIFO - oldest first)
            const nextRide = remaining[0];
            setCurrentRide(nextRide);
            setRideStatus('RINGING');
            setCountdown(20);
        }
    };


    const handleCollectPayment = () => setShowRatingModal(true);

    // Effects
    useEffect(() => {
        // If we have incoming rides and no active ride, take the first one (oldest)
        if (incomingRides.length > 0 && !currentRide) {
            const oldestRide = incomingRides[0];
            if (!rejectedRideIds.has(oldestRide.id)) {
                setCurrentRide(oldestRide);

                // RESTORE STATUS FROM DATABASE IF AVAILABLE
                const dbStatus = oldestRide.status || oldestRide.dbStatus;
                if (dbStatus === 'accepted') {
                    setRideStatus('ACCEPTED');
                    pushNotification('Active Ride Found', 'Continuing your journey to pickup.', 'SYSTEM');
                } else if (dbStatus === 'arrived') {
                    setRideStatus('ARRIVED');
                    pushNotification('Active Ride Found', 'You are currently at the pickup.', 'SYSTEM');
                } else if (dbStatus === 'in-progress') {
                    setRideStatus('NAVIGATING');
                    pushNotification('Active Trip Found', 'Continuing your trip.', 'SYSTEM');
                } else {
                    setRideStatus('RINGING');
                    setCountdown(20);
                    pushNotification('New Request Received!', 'A user needs assistance nearby.', 'RIDE');
                }
            }
        }
    }, [incomingRides, currentRide, rejectedRideIds]);

    // Watcher: if the currently shown ride is removed from incomingRides[] by ProfileContext
    // (because another driver accepted it OR customer cancelled), dismiss the drawer immediately.
    useEffect(() => {
        if (!currentRide || rideStatus !== 'RINGING') return;
        const isStillInQueue = incomingRides.some(r => r.id === currentRide.id);
        if (!isStillInQueue) {
            // Ride was silently taken or cancelled — close drawer now and show alert
            showAlert('Ride Unavailable', 'This request has already been taken by another driver or was cancelled.');
            setCurrentRide(null);
            setRideStatus('IDLE');
            setIsDrawerExpanded(false);
        }
    }, [incomingRides, currentRide?.id, rideStatus]);

    useEffect(() => {
        if (!currentRide) return;
        const channel = supabase
            .channel(`ride_status_${currentRide.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'rides',
                filter: `id=eq.${currentRide.id}`
            }, (payload) => {
                const updatedRide = payload.new;
                if (updatedRide.status === 'cancelled' || (updatedRide.status === 'accepted' && updatedRide.driver_id !== user.id)) {
                    const isOtherDriver = updatedRide.status === 'accepted' && updatedRide.driver_id !== user.id;
                    const title = isOtherDriver ? 'Ride Unavailable' : 'Ride Cancelled';
                    const message = isOtherDriver ? 'This request has already been taken by another driver.' : 'the customer has cancelled the search';

                    showAlert(title, message);
                    setCurrentRide(null);
                    setRideStatus('IDLE');
                    setIsDrawerExpanded(false);
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [currentRide]);

    useEffect(() => {
        if (rideStatus === 'NAVIGATING' && currentRide?.type === 'PASSENGER' && currentRide?.dropoff_lat && currentRide?.dropoff_lng && profile.currentLat && profile.currentLng) {
            const dist = calculateDistance(profile.currentLat, profile.currentLng, currentRide.dropoff_lat, currentRide.dropoff_lng);
            if (dist < 0.05) handleCompleteRide(true);
        }
    }, [profile.currentLat, profile.currentLng, rideStatus, currentRide]);

    useEffect(() => {
        if (rideStatus === 'RINGING') {
            ringingInterval.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (ringingInterval.current) clearInterval(ringingInterval.current);
        }
        return () => { if (ringingInterval.current) clearInterval(ringingInterval.current); };
    }, [rideStatus]);

    // Handle timeout outside of the setState callback to prevent render warnings
    useEffect(() => {
        if (rideStatus === 'RINGING' && countdown === 0) {
            if (ringingInterval.current) clearInterval(ringingInterval.current);
            handleDeclineRide();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdown, rideStatus]);


    return {
        handleAcceptRide,
        handleArrivedAtPickup,
        handleStartRide,
        handleCompleteRide,
        handleCollectPayment,
        submitRating,
        handleSkipRating,
        handleDeclineRide,
        notifyCustomer
    };
};
