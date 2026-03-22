
import { useEffect, useRef, useState } from 'react';
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
    const [isProcessing, setIsProcessing] = useState(false);
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

        // Optimistically set status to ACCEPTED to prevent the "silent removal" 
        // listener in the useEffect below from clearing the state.
        const originalStatus = rideStatus;
        setRideStatus('ACCEPTED');
        setIsProcessing(true);

        try {
            // .select('id') returns the updated rows — if empty, the ride was already taken/cancelled
            const { data: updatedRows, error } = await supabase
                .from('rides')
                .update({ status: 'accepted', driver_id: user.id })
                .eq('id', currentRide.id)
                .eq('status', 'searching') // Only update if still searching (race-safe)
                .select('id');

            if (error || !updatedRows || updatedRows.length === 0) {
                // REVERT: Ride was already taken by another driver or customer cancelled
                console.warn("[handleAcceptRide] Ride unavailable (no rows updated or error):", error);
                setRideStatus(originalStatus); // Return to RINGING
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

            // DB confirmed — status is already set to ACCEPTED optimistically

            // If it's a merchant delivery, sync the associated orders to "delivering"
            if (currentRide.type === 'MERCHANT_DELIVERY' || currentRide.ride_type === 'MERCHANT_DELIVERY') {
                if (currentRide.batch_id) {
                    await supabase.from('orders')
                        .update({
                            status: 'delivering',
                            driver_id: user.id
                        })
                        .eq('batch_id', currentRide.batch_id)
                        .eq('status', 'ready');
                } else {
                    // Fallback for single orders not using batch_id
                    await supabase.from('orders').update({ status: 'delivering', driver_id: user.id }).eq('id', currentRide.order_id || currentRide.id).eq('status', 'ready');
                }
            }

            // REJECT ALL OTHER PENDING REQUESTS IN QUEUE
            const otherRideIds = incomingRides.filter(r => r.id !== currentRide.id).map(r => r.id);
            if (otherRideIds.length > 0) {
                setRejectedRideIds((prev: Set<string>) => {
                    const newSet = new Set(prev);
                    otherRideIds.forEach(id => newSet.add(id));
                    return newSet;
                });
            }

            const isDelivery = currentRide.type === 'DELIVERY' || currentRide.type === 'MERCHANT_DELIVERY';
            pushNotification(isDelivery ? 'Delivery Accepted' : 'Ride Accepted', `Navigating to pickup`, 'SYSTEM');
            setIncomingRides([]); // Clear the queue since we accepted one
        } catch (err) {
            console.error("[handleAcceptRide] critical error:", err);
            setRideStatus(originalStatus); // Rollback on critical error
            showAlert('Error', 'An unexpected error occurred while accepting the ride.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleArrivedAtPickup = async () => {
        if (!currentRide) return;
        setIsProcessing(true);
        try {
            setRideStatus('ARRIVED');
            setIsDrawerExpanded(false);
            await supabase.from('rides').update({ status: 'arrived' }).eq('id', currentRide.id);

            // Sync associated orders for merchant deliveries
            if (currentRide.type === 'MERCHANT_DELIVERY' || currentRide.ride_type === 'MERCHANT_DELIVERY') {
                if (currentRide.batch_id) {
                    await supabase.from('orders')
                        .update({
                            status: 'arrived',
                            driver_id: user.id
                        })
                        .eq('batch_id', currentRide.batch_id);
                } else {
                    await supabase.from('orders').update({ status: 'arrived', driver_id: user.id }).eq('id', currentRide.order_id || currentRide.id);
                }
            }

            const isDelivery = currentRide.type === 'DELIVERY' || currentRide.type === 'MERCHANT_DELIVERY';
            pushNotification(isDelivery ? 'Delivery Update' : 'You have Arrived', isDelivery ? 'Notify the merchant you are here.' : 'Notify the passenger you are here.', 'SYSTEM');
            notifyCustomer('Driver Arrived', isDelivery ? 'Your driver has arrived at the pickup location!' : 'Your driver has arrived at the pickup location!');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStartRide = async () => {
        if (!currentRide) return;
        setIsProcessing(true);
        try {
            setRideStatus('NAVIGATING');
            setIsDrawerExpanded(false);
            await supabase.from('rides').update({ status: 'in-progress' }).eq('id', currentRide.id);
            const isDelivery = currentRide.type === 'DELIVERY' || currentRide.type === 'MERCHANT_DELIVERY';
            pushNotification(isDelivery ? 'Delivery Started' : 'Ride Started', isDelivery ? 'Delivery in progress. Drive safely!' : 'Destination revealed. Drive safely!', 'RIDE');
            notifyCustomer(isDelivery ? 'Delivery Started' : 'Trip Started', isDelivery ? 'Your package is on the way!' : 'Your driver has started the trip. Enjoy the ride!');
            if (user && !profile.isOnline) {
                await supabase.from('drivers').update({ is_online: true }).eq('id', user.id);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCompleteRide = async (isAuto = false) => {
        if (!currentRide || !user) return;

        setIsProcessing(true);
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

            const isDelivery = currentRide.type === 'DELIVERY' || currentRide.type === 'MERCHANT_DELIVERY';
            if (data.final_price > 0) {
                notifyCustomer(isDelivery ? 'Delivery Completed' : 'Trip Completed', isDelivery ? 'Your delivery has been completed. Thank you!' : 'You have arrived at your destination. Thank you for riding!');
                // Follow up with a rating reminder
                notifyCustomer('Rate your Experience', `Please take a moment to rate your ${isDelivery ? 'delivery' : 'driver'}. Your feedback helps us improve!`);
                pushNotification(isDelivery ? 'Delivery Completed' : 'Ride Completed', `Total: ${appSettings.currency_symbol}${data.final_price}`, 'RIDE');
            } else {
                notifyCustomer(isDelivery ? 'Delivery Cancelled' : 'Ride Cancelled', 'The ride was ended with zero movement.');
                pushNotification(isDelivery ? 'Delivery Ended' : 'Ride Ended', 'No movement detected. Ride cancelled.', 'SYSTEM');
                setRideStatus('IDLE');
                setCurrentRide(null);
                setIsDrawerExpanded(false);
                return;
            }
            await syncProfile();
        } catch (e: any) {
            console.error("Error completing ride via RPC:", e);
            pushNotification('Error', e.message || 'Failed to complete ride properly.', 'SYSTEM');
        } finally {
            setIsProcessing(false);
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

        setRejectedRideIds(currentRide.id);

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
        // If we have incoming rides and no active ride (or we are on the summary/completed screen), take the first one
        if (incomingRides.length > 0 && (!currentRide || rideStatus === 'COMPLETED')) {
            const oldestRide = incomingRides[0];
            if (!rejectedRideIds.has(oldestRide.id)) {
                // If it's a new request and we were on a summary, clear state first
                if (rideStatus === 'COMPLETED') {
                    setHasCollectedPayment(false);
                    setUserRating(0);
                    setShowRatingModal(false);
                }
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
        if (!currentRide || (rideStatus !== 'RINGING' && rideStatus !== 'IDLE')) return;
        const isStillInQueue = incomingRides.some(r => r.id === currentRide.id);
        if (!isStillInQueue) {
            // ONLY show alert if it was a "surprise" removal while it was ringing
            if (rideStatus === 'RINGING') {
                showAlert('Ride Unavailable', 'This request has already been taken by another driver or was cancelled.');
            }

            if (incomingRides.length > 0) {
                setCurrentRide(incomingRides[0]);
                setCountdown(20);
            } else {
                setCurrentRide(null);
                setRideStatus('IDLE');
                setIsDrawerExpanded(false);
            }
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
        const isRideOrDelivery = currentRide?.type === 'PASSENGER' || currentRide?.type === 'DELIVERY' || currentRide?.type === 'MERCHANT_DELIVERY' || currentRide?.ride_type === 'MERCHANT_DELIVERY';
        if (rideStatus === 'NAVIGATING' && isRideOrDelivery && currentRide?.dropoff_lat && currentRide?.dropoff_lng && profile.currentLat && profile.currentLng) {
            const dist = calculateDistance(profile.currentLat, profile.currentLng, currentRide.dropoff_lat, currentRide.dropoff_lng);
            if (dist < 0.075) handleCompleteRide(true);
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
        notifyCustomer,
        isProcessing
    };
};
