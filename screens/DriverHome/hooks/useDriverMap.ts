
import { useState, useEffect, useRef } from 'react';

const VEHICLE_ICONS = {
    ECONOMIC: '/assets/car_economic_3d.png',
    SCOOTER_TUKTUK: '/assets/car_scooter_3d.png',
    PREMIUM: '/assets/car_premium_3d.png',
};

// Persistent Map Container to prevent reloading
let persistentMapDiv: HTMLDivElement | null = null;
let persistentMapInstance: any = null;
let persistentMarker: any = null;

export const useDriverMap = (
    profile: any,
    isDarkMode: boolean,
    rideStatus: string,
    currentRide: any,
    isFollowing: boolean,
    setIsFollowing: (val: boolean) => void,
    setNavigationInfo: (info: { distance: string; duration: string }) => void
) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapInstance = useRef<any>(null);
    const driverMarker = useRef<any>(null);
    const passengerMarker = useRef<any>(null);
    const directionsRenderer = useRef<any>(null);
    const directionsService = useRef<any>(null);
    const infoWindowRef = useRef<any>(null);

    // Initialize Map and Services with Persistence
    useEffect(() => {
        const google = (window as any).google;
        if (!google || !google.maps || !mapRef.current) return;

        try {
            if (!persistentMapDiv) {
                persistentMapDiv = document.createElement('div');
                persistentMapDiv.style.width = '100%';
                persistentMapDiv.style.height = '100%';

                persistentMarker = null;

                const center = { lat: 13.4432, lng: -16.6776 };
                persistentMapInstance = new google.maps.Map(persistentMapDiv, {
                    center,
                    zoom: 17,
                    disableDefaultUI: true,
                    gestureHandling: 'greedy',
                    mapId: '6c276b29bd3b4cd8'
                });

                const vehicleType = profile.vehicle?.type || 'ECONOMIC';
                const iconUrl = VEHICLE_ICONS[vehicleType as keyof typeof VEHICLE_ICONS];

                try {
                    if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
                        const carWrapper = document.createElement('div');
                        carWrapper.style.pointerEvents = 'none';
                        carWrapper.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 10px 8px rgba(0,0,0,0.3));">
                <img src="${iconUrl}" style="width: 50px; height: 50px; object-fit: contain; transform: rotate(${profile.heading || 0}deg); transform-origin: center center;" />
              </div>
            `;

                        persistentMarker = new google.maps.marker.AdvancedMarkerElement({
                            position: center,
                            map: persistentMapInstance,
                            content: carWrapper,
                            zIndex: 100
                        });
                    }
                } catch (markerError) {
                    console.warn('Advanced Marker Error', markerError);
                }

                driverMarker.current = persistentMarker;
            }

            if (mapRef.current && persistentMapDiv && !mapRef.current.contains(persistentMapDiv)) {
                mapRef.current.appendChild(persistentMapDiv);
            }

            googleMapInstance.current = persistentMapInstance;
            driverMarker.current = persistentMarker;

            if (driverMarker.current && persistentMapInstance) {
                if (driverMarker.current.map !== persistentMapInstance) {
                    driverMarker.current.map = persistentMapInstance;
                }
                const currentIcon = VEHICLE_ICONS[(profile.vehicle?.type || 'ECONOMIC') as keyof typeof VEHICLE_ICONS];
                if (driverMarker.current.content) {
                    const img = driverMarker.current.content.querySelector('img');
                    if (img && img.src !== currentIcon) img.src = currentIcon;
                }
            }

            if (!directionsService.current) directionsService.current = new google.maps.DirectionsService();
            if (!directionsRenderer.current) {
                directionsRenderer.current = new google.maps.DirectionsRenderer({
                    map: googleMapInstance.current,
                    preserveViewport: true,
                    suppressMarkers: true,
                    polylineOptions: { strokeColor: '#00E39A', strokeWeight: 6, strokeOpacity: 0.9 }
                });
            }
        } catch (error) {
            console.error('Error initializing map:', error);
        }
    }, [isDarkMode]);

    // Smooth Moving & Rotating System + Passenger Marker
    useEffect(() => {
        const google = (window as any).google;
        if (!profile.isOnline || !googleMapInstance.current) {
            if (passengerMarker.current) {
                passengerMarker.current.map = null;
                passengerMarker.current = null;
            }
            return;
        }

        const handleOrientation = (event: any) => {
            if (!driverMarker.current || !driverMarker.current.content) return;

            let heading = 0;
            if (event.webkitCompassHeading) {
                heading = event.webkitCompassHeading;
            } else if (event.alpha) {
                heading = (360 - event.alpha) % 360;
            }

            const img = driverMarker.current.content.querySelector('img');
            if (img && heading) {
                img.style.transform = `rotate(${heading}deg)`;
            }
        };

        const startCompass = async () => {
            if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                try {
                    const perms = await (DeviceOrientationEvent as any).requestPermission();
                    if (perms === 'granted') window.addEventListener('deviceorientation', handleOrientation);
                } catch (e) { console.warn(e); }
            } else {
                window.addEventListener('deviceorientation', handleOrientation);
            }
        };
        startCompass();

        const targetPos = { lat: profile.currentLat || 13.4432, lng: profile.currentLng || -16.6776 };
        const currentPosRef = driverMarker.current?.position || targetPos;
        let animationFrameId: number;
        let startTime: number;
        const duration = 1000;

        const animateMarker = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            if (driverMarker.current) {
                const lat = currentPosRef.lat + (targetPos.lat - currentPosRef.lat) * progress;
                const lng = currentPosRef.lng + (targetPos.lng - currentPosRef.lng) * progress;
                const nextPos = { lat, lng };

                if (typeof driverMarker.current.setPosition === 'function') {
                    driverMarker.current.setPosition(nextPos);
                } else {
                    driverMarker.current.position = nextPos;
                }

                if (isFollowing && !currentRide) {
                    googleMapInstance.current.panTo(nextPos);
                }
            }

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animateMarker);
            } else {
                if (driverMarker.current) driverMarker.current.position = targetPos;
            }
        };

        animationFrameId = requestAnimationFrame(animateMarker);

        const shouldShowPassenger = currentRide && (rideStatus === 'ACCEPTED' || rideStatus === 'ARRIVED');
        if (shouldShowPassenger && currentRide.pickup_lat && currentRide.pickup_lng) {
            const passengerPos = { lat: currentRide.pickup_lat, lng: currentRide.pickup_lng };
            const isMerchant = currentRide.type === 'MERCHANT_DELIVERY' || currentRide.ride_type === 'MERCHANT_DELIVERY';

            const renderPassengerContent = () => {
                const wrapper = document.createElement('div');
                const hasImage = isMerchant ? !!currentRide.merchants?.[0]?.image : !!currentRide.passengerImage;
                const imgUrl = isMerchant ? currentRide.merchants?.[0]?.image : currentRide.passengerImage;

                if (isMerchant) {
                    wrapper.innerHTML = `
                      <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3)); cursor: pointer;">
                        <div style="width: 48px; height: 48px; background: white; border: 3px solid #10B981; border-radius: 50%; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center; ${!hasImage ? 'box-shadow: 0 0 15px #10B981;' : ''}">
                           ${hasImage
                            ? `<img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
                            : `<div style="width: 20px; height: 20px; background: #10B981; border-radius: 50%; animation: pulse 2s infinite;"></div>`
                        }
                        </div>
                        <style>
                          @keyframes pulse {
                            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
                            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                          }
                        </style>
                      </div>
                    `;
                } else {
                    wrapper.innerHTML = `
                      <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));">
                        <div style="width: 44px; height: 44px; background: white; border: 3px solid #10B981; border-radius: 50%; overflow: hidden; position: relative; display: flex; items-center; justify-center;">
                           ${hasImage
                            ? `<img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
                            : `<div style="width: 100%; height: 100%; background: #10B981; display: flex; align-items: center; justify-center;">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                              </svg>
                            </div>`
                        }
                        </div>
                        <div style="width: 4px; height: 10px; background: #10B981; border-radius: 2px;"></div>
                        <div style="width: 12px; height: 12px; background: #10B981; border-radius: 50%; margin-top: -6px; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.2);"></div>
                      </div>
                    `;
                }
                return wrapper;
            };

            if (!passengerMarker.current) {
                passengerMarker.current = new google.maps.marker.AdvancedMarkerElement({
                    position: passengerPos,
                    map: googleMapInstance.current,
                    content: renderPassengerContent(),
                    zIndex: 90
                });

                if (rideStatus === 'ACCEPTED' || rideStatus === 'ARRIVED') {
                    const bounds = new google.maps.LatLngBounds();
                    bounds.extend(new google.maps.LatLng(profile.currentLat, profile.currentLng));
                    bounds.extend(new google.maps.LatLng(passengerPos.lat, passengerPos.lng));
                    googleMapInstance.current.fitBounds(bounds, { top: 100, bottom: 300, left: 50, right: 50 });
                }
            } else {
                passengerMarker.current.position = passengerPos;
                passengerMarker.current.content = renderPassengerContent();
                passengerMarker.current.map = googleMapInstance.current;
            }
        } else if (currentRide && rideStatus === 'NAVIGATING' && currentRide.dropoff_lat && currentRide.dropoff_lng) {
            const dropoffPos = { lat: currentRide.dropoff_lat, lng: currentRide.dropoff_lng };
            const isMerchant = currentRide.type === 'MERCHANT_DELIVERY' || currentRide.ride_type === 'MERCHANT_DELIVERY';

            const renderDropoffContent = () => {
                const wrapper = document.createElement('div');
                const hasImage = !!currentRide.passengerImage;
                const imgUrl = currentRide.passengerImage;

                if (isMerchant) {
                    // For Merchant Delivery, the dropoff is the customer
                    wrapper.innerHTML = `
                      <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3)); cursor: pointer;">
                        <div style="width: 48px; height: 48px; background: white; border: 3px solid #3B82F6; border-radius: 50%; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center; ${!hasImage ? 'box-shadow: 0 0 15px #3B82F6;' : ''}">
                           ${hasImage
                            ? `<img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
                            : `<div style="width: 20px; height: 20px; background: #3B82F6; border-radius: 50%; animation: pulseBlue 2s infinite;"></div>`
                        }
                        </div>
                        <style>
                          @keyframes pulseBlue {
                            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
                            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
                            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
                          }
                        </style>
                      </div>
                    `;
                } else {
                    wrapper.innerHTML = `
                      <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));">
                        <div style="width: 44px; height: 44px; background: white; border: 3px solid #EF4444; border-radius: 50%; overflow: hidden; position: relative; display: flex; items-center; justify-center;">
                           ${hasImage
                            ? `<img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
                            : `<div style="width: 100%; height: 100%; background: #EF4444; display: flex; align-items: center; justify-center;">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                              </svg>
                            </div>`
                        }
                        </div>
                        <div style="width: 4px; height: 10px; background: #EF4444; border-radius: 2px;"></div>
                        <div style="width: 12px; height: 12px; background: #EF4444; border-radius: 50%; margin-top: -6px; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.2);"></div>
                      </div>
                    `;
                }
                return wrapper;
            };

            if (!passengerMarker.current) {
                passengerMarker.current = new google.maps.marker.AdvancedMarkerElement({
                    position: dropoffPos,
                    map: googleMapInstance.current,
                    content: renderDropoffContent(),
                    zIndex: 90,
                    title: isMerchant ? currentRide.passengerName : 'Dropoff'
                });
            } else {
                passengerMarker.current.position = dropoffPos;
                passengerMarker.current.content = renderDropoffContent();
                passengerMarker.current.map = googleMapInstance.current;
                passengerMarker.current.title = isMerchant ? currentRide.passengerName : 'Dropoff';
            }

            // Task 4: Tap to show name
            passengerMarker.current.addListener('click', () => {
                if (infoWindowRef.current) infoWindowRef.current.close();
                infoWindowRef.current = new google.maps.InfoWindow({
                    content: `<div style="padding: 8px; font-weight: bold; color: #111; font-family: sans-serif;">${currentRide.passengerName}</div>`
                });
                infoWindowRef.current.open(googleMapInstance.current, passengerMarker.current);
            });

            const bounds = new google.maps.LatLngBounds();
            bounds.extend(new google.maps.LatLng(profile.currentLat, profile.currentLng));
            bounds.extend(new google.maps.LatLng(dropoffPos.lat, dropoffPos.lng));
            googleMapInstance.current.fitBounds(bounds, { top: 100, bottom: 300, left: 50, right: 50 });

        } else if (passengerMarker.current) {
            passengerMarker.current.map = null;
            passengerMarker.current = null;
        }

        const vehicleType = profile.vehicle?.type || 'ECONOMIC';
        const iconUrl = VEHICLE_ICONS[vehicleType as keyof typeof VEHICLE_ICONS];
        if (driverMarker.current && driverMarker.current.content) {
            const img = driverMarker.current.content.querySelector('img');
            if (img && img.src !== iconUrl) img.src = iconUrl;
        }

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation);
            cancelAnimationFrame(animationFrameId);
        };
    }, [profile.currentLat, profile.currentLng, profile.isOnline, profile.vehicle?.type, isFollowing, currentRide, rideStatus]);

    // Directions Logic
    useEffect(() => {
        if (!directionsRenderer.current || !currentRide || (rideStatus !== 'ACCEPTED' && rideStatus !== 'ARRIVED' && rideStatus !== 'NAVIGATING')) {
            if (directionsRenderer.current) directionsRenderer.current.setDirections({ routes: [] });
            return;
        }

        const google = (window as any).google;
        const origin = { lat: profile.currentLat, lng: profile.currentLng };

        // If arrived or navigating, destination is dropoff
        // If accepted but not arrived, destination is pickup
        const destLat = (rideStatus === 'NAVIGATING' || rideStatus === 'ARRIVED') ?
            (currentRide.dropoff_lat ?? currentRide.pickup_lat) : currentRide.pickup_lat;
        const destLng = (rideStatus === 'NAVIGATING' || rideStatus === 'ARRIVED') ?
            (currentRide.dropoff_lng ?? currentRide.pickup_lng) : currentRide.pickup_lng;

        const destination = { lat: destLat, lng: destLng };

        if (!destination.lat || !destination.lng) {
            console.warn("🗺️ Map: Skipping directions - destination coords are missing/null", {
                status: rideStatus,
                destination,
                rideId: currentRide.id
            });
            return;
        }

        directionsService.current.route({
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: false,
            unitSystem: google.maps.UnitSystem.METRIC,
        }, (result: any, status: any) => {
            if (status === 'OK') {
                console.log("🗺️ Map: Directions result OK");
                directionsRenderer.current.setDirections(result);
                const leg = result.routes[0].legs[0];
                setNavigationInfo({
                    distance: leg.distance.text,
                    duration: leg.duration.text
                });
            } else {
                console.error("🗺️ Map: Directions request failed", status);
            }
        });
    }, [rideStatus, currentRide?.id, profile.currentLat, profile.currentLng]);

    return {
        mapRef,
        googleMapInstance,
        driverMarker,
        passengerMarker,
        directionsRenderer,
        directionsService
    };
};
