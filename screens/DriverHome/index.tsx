
import React, { useState, useRef } from 'react';
import { Navigation, Power } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RideDrawer } from '../../components/RideDrawer';
import { supabase } from '../../lib/supabase';
import { calculateDistance } from '../../utils/geo';

// Hooks
import { useDriverMap } from './hooks/useDriverMap';
import { useRideLifecycle } from './hooks/useRideLifecycle';
import { useDriverStatus } from './hooks/useDriverStatus';

// Components
import { RatingModal } from './components/RatingModal';
import { NavigationOverlay } from './components/NavigationOverlay';
import { DriverRestriction } from './components/DriverRestriction';
import { OnlineOverlay } from './components/OnlineOverlay';

export const DriverHome: React.FC = () => {
    const {
        profile,
        toggleOnlineStatus,
        pushNotification,
        openChat,
        currentRide,
        setCurrentRide,
        rideStatus,
        setRideStatus,
        user,
        incomingRides,
        setIncomingRides,
        appSettings,
        isLocked,
        rejectedRideIds,
        setRejectedRideIds,
        setCurrentTab,
        syncProfile,
        isDarkMode,
        showAlert
    } = useApp();

    const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [hasCollectedPayment, setHasCollectedPayment] = useState(false);
    const [userRating, setUserRating] = useState(0);
    const [countdown, setCountdown] = useState(20);
    const [showDirections, setShowDirections] = useState(false);
    const [navigationInfo, setNavigationInfo] = useState({ distance: '...', duration: '...' });
    const [isFollowing, setIsFollowing] = useState(true);

    const APP_WIDTH = Math.min(window.innerWidth, 448);
    const [dragPos, setDragPos] = useState({ x: APP_WIDTH - 70, y: 100 });
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const {
        mapRef,
        directionsRenderer,
    } = useDriverMap(
        profile,
        isDarkMode,
        rideStatus,
        currentRide,
        isFollowing,
        setIsFollowing,
        setNavigationInfo
    );

    const {
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
    } = useRideLifecycle(
        user,
        profile,
        currentRide,
        setCurrentRide,
        rideStatus,
        setRideStatus,
        incomingRides,
        setIncomingRides,
        rejectedRideIds,
        setRejectedRideIds,
        pushNotification,
        showAlert,
        setShowRatingModal,
        setHasCollectedPayment,
        setUserRating,
        userRating,
        setIsDrawerExpanded,
        appSettings,
        syncProfile,
        countdown,
        setCountdown,
        calculateDistance
    );

    const { handleToggleOnline } = useDriverStatus(
        profile,
        toggleOnlineStatus,
        currentRide,
        setCurrentRide,
        rideStatus,
        setRideStatus,
        setIncomingRides,
        handleCompleteRide
    );

    const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        isDragging.current = true;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        dragOffset.current = { x: clientX - dragPos.x, y: clientY - dragPos.y };
    };

    const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const newX = Math.min(Math.max(0, clientX - dragOffset.current.x), APP_WIDTH - 60);
        const newY = Math.min(Math.max(50, clientY - dragOffset.current.y), window.innerHeight - 150);
        setDragPos({ x: newX, y: newY });
    };

    const handleDragEnd = () => { isDragging.current = false; };
    const toggleDrawer = () => setIsDrawerExpanded(!isDrawerExpanded);

    if (isLocked) {
        return (
            <DriverRestriction
                isLocked={isLocked}
                isSuspended={profile.isSuspended}
                commissionDebt={profile.commissionDebt}
                setCurrentTab={setCurrentTab}
            />
        );
    }

    return (
        <div
            className="relative h-full w-full bg-white dark:bg-[#1C1C1E] overflow-hidden font-sans"
            onTouchMove={handleDragMove}
            onMouseMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onMouseUp={handleDragEnd}
        >
            <div ref={mapRef} className={`absolute inset-0 transition-opacity duration-700 ${profile.isOnline ? 'opacity-100' : 'opacity-60 grayscale'}`} />

            <OnlineOverlay isOnline={profile.isOnline} handleToggleOnline={handleToggleOnline} />

            {profile.isOnline && !isFollowing && !currentRide && (
                <div className="absolute top-20 right-6 z-30 animate-in fade-in zoom-in">
                    <button onClick={() => setIsFollowing(true)} className="w-12 h-12 rounded-full bg-white dark:bg-[#1C1C1E] text-blue-500 shadow-xl flex items-center justify-center active:scale-90 transition-transform"><Navigation size={20} className="fill-current" /></button>
                </div>
            )}

            {profile.isOnline && (
                <div className="absolute top-4 right-6 z-30">
                    <button onClick={handleToggleOnline} className="w-12 h-12 rounded-full bg-white dark:bg-[#1C1C1E] text-red-500 shadow-xl flex items-center justify-center active:scale-90 transition-transform"><Power size={20} /></button>
                </div>
            )}

            <NavigationOverlay
                rideStatus={rideStatus}
                currentRide={currentRide}
                showDirections={showDirections}
                setShowDirections={setShowDirections}
                navigationInfo={navigationInfo}
                dragPos={dragPos}
                handleDragStart={handleDragStart}
                isDragging={isDragging.current}
            />

            <RatingModal
                currentRide={currentRide}
                showRatingModal={showRatingModal}
                hasCollectedPayment={hasCollectedPayment}
                userRating={userRating}
                appSettings={appSettings}
                setHasCollectedPayment={setHasCollectedPayment}
                setUserRating={setUserRating}
                submitRating={submitRating}
                handleSkipRating={handleSkipRating}
            />

            {currentRide && !showRatingModal && (
                <RideDrawer
                    currentRide={currentRide}
                    rideStatus={rideStatus}
                    isDrawerExpanded={isDrawerExpanded}
                    toggleDrawer={toggleDrawer}
                    onAccept={handleAcceptRide}
                    onDecline={handleDeclineRide}
                    onCancel={async () => {
                        if (!currentRide) return;
                        const originalStatus = rideStatus;

                        if (originalStatus === 'NAVIGATING' && currentRide.pickup_lat && currentRide.pickup_lng && profile.currentLat && profile.currentLng) {
                            const actualDist = calculateDistance(currentRide.pickup_lat, currentRide.pickup_lng, profile.currentLat, profile.currentLng);
                            if (actualDist >= 0.05) {
                                try {
                                    const { data, error } = await supabase.rpc('complete_ride', {
                                        p_ride_id: currentRide.id,
                                        p_driver_id: user?.id,
                                        p_actual_lat: profile.currentLat,
                                        p_actual_lng: profile.currentLng,
                                        p_is_auto: false
                                    });
                                    if (error) throw error;
                                    if (!data.success) throw new Error(data.error);
                                    setCurrentRide(prev => prev ? { ...prev, price: data.final_price } : null);
                                    setShowRatingModal(true);
                                    await syncProfile();
                                    return;
                                } catch (e: any) {
                                    console.error("Mid-trip completion error:", e);
                                    pushNotification('Error', 'Failed to settle trip.', 'SYSTEM');
                                    return;
                                }
                            }
                        }

                        const isMerchant = currentRide.type === 'MERCHANT_DELIVERY' || currentRide.ride_type === 'MERCHANT_DELIVERY';
                        try {
                            if (isMerchant) {
                                // For merchant deliveries, slide to cancel just releases the driver but keeps request alive
                                const { error } = await supabase
                                    .from('rides')
                                    .update({ status: 'searching', driver_id: null })
                                    .eq('id', currentRide.id);
                                if (error) throw error;

                                if (currentRide.batch_id) {
                                    await supabase.from('orders').update({ status: 'ready' }).eq('batch_id', currentRide.batch_id);
                                }
                            } else {
                                const { data, error } = await supabase.rpc('cancel_ride_driver', {
                                    p_ride_id: currentRide.id,
                                    p_driver_id: user?.id
                                });

                                if (error) throw error;
                                if (data && !data.success) throw new Error(data.error || 'Failed to cancel');
                            }
                        } catch (error: any) {
                            console.error('Cancellation error:', error);
                            pushNotification('Sync Error', 'Failed to cancel trip.', 'SYSTEM');
                            return;
                        }
                        const isDelivery = currentRide.type === 'DELIVERY' || isMerchant;
                        notifyCustomer(isDelivery ? 'Delivery Update' : 'Ride Cancelled', isMerchant ? 'Driver unassigned. Searching for a new one.' : 'Driver had to cancel.');
                        pushNotification(isDelivery ? 'Delivery Cancelled' : 'Trip Cancelled', 'Status changed to cancelled.', 'SYSTEM');
                        setCurrentRide(null);
                        setIncomingRides([]);
                        setRideStatus('IDLE');
                        setIsDrawerExpanded(false);
                    }}
                    isProcessing={isProcessing}
                    onArrived={handleArrivedAtPickup}
                    onStartRide={handleStartRide}
                    onComplete={handleCompleteRide}
                    onChat={() => openChat({ id: `chat-${currentRide.id}`, participantName: currentRide.passengerName, contextId: currentRide.id })}
                    onCollectPayment={handleCollectPayment}
                    countdown={countdown}
                    rideType={currentRide.type as any}
                    queueCount={incomingRides.length}
                    currentLat={profile.currentLat}
                    currentLng={profile.currentLng}
                />
            )}
        </div>
    );
};
