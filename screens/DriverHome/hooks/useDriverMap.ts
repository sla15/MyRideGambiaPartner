
import { useState, useEffect, useRef } from 'react';

const VEHICLE_ICONS: Record<string, string> = {
    ECONOMIC: '/assets/car_economic_3d.png',
    SCOOTER_TUKTUK: '/assets/car_scooter_3d.png',
    PREMIUM: '/assets/car_premium_3d.png',
};

// Persistent map container — survives React re-renders
let persistentMapDiv: HTMLDivElement | null = null;
let persistentMapInstance: any = null;
let persistentDriverMarker: any = null;

export const useDriverMap = (
    profile: any,
    isDarkMode: boolean,
    rideStatus: string,
    currentRide: any,
    isFollowing: boolean,
    setIsFollowing: (val: boolean) => void,
    setNavigationInfo: (info: { distance: string; duration: string }) => void,
    onMarkerClick?: (data: any) => void
) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapInstance = useRef<any>(null);
    const driverMarker = useRef<any>(null);
    const passengerMarker = useRef<any>(null);
    const shopMarkers = useRef<any[]>([]);
    const dropoffMarkers = useRef<any[]>([]);
    const directionsRenderer = useRef<any>(null);
    const directionsService = useRef<any>(null);
    const infoWindowRef = useRef<any>(null);
    const pickupSvgUrl = useRef<string | null>(null);

    // ─── EFFECT 0: Map Initialisation ────────────────────────────────────────
    useEffect(() => {
        const google = (window as any).google;
        if (!google?.maps || !mapRef.current) return;

        try {
            if (!persistentMapDiv) {
                persistentMapDiv = document.createElement('div');
                persistentMapDiv.style.width = '100%';
                persistentMapDiv.style.height = '100%';

                const center = { lat: 13.4432, lng: -16.6776 };
                persistentMapInstance = new google.maps.Map(persistentMapDiv, {
                    center,
                    zoom: 17,
                    disableDefaultUI: true,
                    gestureHandling: 'greedy',
                    mapId: '6c276b29bd3b4cd8'
                });

                const vehicleType = profile.vehicle?.type || 'ECONOMIC';
                const iconUrl = VEHICLE_ICONS[vehicleType] || VEHICLE_ICONS.ECONOMIC;

                try {
                    if (google.maps.marker?.AdvancedMarkerElement) {
                        const carWrapper = document.createElement('div');
                        carWrapper.style.pointerEvents = 'none';
                        carWrapper.innerHTML = `
                            <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 10px 8px rgba(0,0,0,0.3));">
                                <img src="${iconUrl}" style="width:50px;height:50px;object-fit:contain;transform:rotate(0deg);transform-origin:center center;" />
                            </div>`;
                        persistentDriverMarker = new google.maps.marker.AdvancedMarkerElement({
                            position: center,
                            map: persistentMapInstance,
                            content: carWrapper,
                            zIndex: 100
                        });
                    }
                } catch (_) { }
            }

            if (mapRef.current && persistentMapDiv && !mapRef.current.contains(persistentMapDiv)) {
                mapRef.current.appendChild(persistentMapDiv);
            }

            googleMapInstance.current = persistentMapInstance;
            driverMarker.current = persistentDriverMarker;

            if (!directionsService.current) directionsService.current = new google.maps.DirectionsService();
            if (!directionsRenderer.current) {
                directionsRenderer.current = new google.maps.DirectionsRenderer({
                    suppressMarkers: true,
                    preserveViewport: true,
                    polylineOptions: { strokeColor: '#00E39A', strokeWeight: 6, strokeOpacity: 0.92, zIndex: 10 }
                });
            }
        } catch (err) {
            console.error('Map init error:', err);
        }
    }, [isDarkMode]);

    // ─── EFFECT 1: Driver movement + pickup markers ───────────────────────────
    useEffect(() => {
        const google = (window as any).google;
        if (!profile.isOnline || !googleMapInstance.current) {
            if (passengerMarker.current) {
                try { passengerMarker.current.setMap(null); } catch (_) { try { passengerMarker.current.map = null; } catch (__) { } }
                passengerMarker.current = null;
            }
            return;
        }

        // Compass heading
        const handleOrientation = (event: any) => {
            if (!driverMarker.current?.content) return;
            const heading = event.webkitCompassHeading || ((360 - (event.alpha || 0)) % 360);
            const img = driverMarker.current.content.querySelector('img');
            if (img && heading) img.style.transform = `rotate(${heading}deg)`;
        };
        const startCompass = async () => {
            if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                try {
                    if (await (DeviceOrientationEvent as any).requestPermission() === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                    }
                } catch (_) { }
            } else {
                window.addEventListener('deviceorientation', handleOrientation);
            }
        };
        startCompass();

        // Smooth marker animation
        const targetPos = { lat: profile.currentLat || 13.4432, lng: profile.currentLng || -16.6776 };
        const currentPos = driverMarker.current?.position || targetPos;
        let animationFrameId: number;
        let startTime: number;
        const duration = (navigator.hardwareConcurrency || 4) <= 2 ? 1500 : 1000;
        const totalDist = Math.sqrt(Math.pow(targetPos.lat - currentPos.lat, 2) + Math.pow(targetPos.lng - currentPos.lng, 2));

        if (totalDist < 0.00001) {
            if (driverMarker.current) {
                try { driverMarker.current.setPosition?.(targetPos) ?? (driverMarker.current.position = targetPos); } catch (_) { }
            }
        } else {
            const animateMarker = (timestamp: number) => {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / duration, 1);
                const pos = { lat: currentPos.lat + (targetPos.lat - currentPos.lat) * progress, lng: currentPos.lng + (targetPos.lng - currentPos.lng) * progress };
                if (driverMarker.current) {
                    try { driverMarker.current.setPosition?.(pos) ?? (driverMarker.current.position = pos); } catch (_) { }
                }
                if (isFollowing && !currentRide && googleMapInstance.current) {
                    const center = googleMapInstance.current.getCenter();
                    const d = Math.abs(center.lat() - pos.lat) + Math.abs(center.lng() - pos.lng);
                    if (d > 0.0005) googleMapInstance.current.panTo(pos);
                }
                if (progress < 1) animationFrameId = requestAnimationFrame(animateMarker);
            };
            animationFrameId = requestAnimationFrame(animateMarker);
        }

        // Update vehicle icon
        const vehicleType = profile.vehicle?.type || 'ECONOMIC';
        const iconUrl = VEHICLE_ICONS[vehicleType] || VEHICLE_ICONS.ECONOMIC;
        if (driverMarker.current?.content) {
            const img = driverMarker.current.content.querySelector('img');
            if (img && !img.src.endsWith(iconUrl)) img.src = iconUrl;
        }

        // ─ Pickup markers (ACCEPTED / ARRIVED phases only) ─
        const isMerchant = currentRide && (currentRide.type === 'MERCHANT_DELIVERY' || currentRide.ride_type === 'MERCHANT_DELIVERY');
        const shouldShowPickup = currentRide && (rideStatus === 'ACCEPTED' || rideStatus === 'ARRIVED');

        if (shouldShowPickup) {
            if (isMerchant) {
                if (passengerMarker.current) {
                    try { passengerMarker.current.setMap(null); } catch (_) { }
                    passengerMarker.current = null;
                }
                shopMarkers.current.forEach(m => { try { m.setMap ? m.setMap(null) : (m.map = null); } catch (_) { } });
                shopMarkers.current = [];

                const merchants = currentRide.merchants || [];
                const bounds = new google.maps.LatLngBounds();
                bounds.extend(new google.maps.LatLng(profile.currentLat, profile.currentLng));

                merchants.forEach((m: any) => {
                    if (!m.lat || !m.lng) return;
                    const color = m.isReady ? '#10B981' : '#FBBF24';
                    const dotWrapper = document.createElement('div');
                    dotWrapper.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.2));cursor:pointer;"><div style="width:24px;height:24px;background:white;border:3px solid ${color};border-radius:50%;display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:${color};border-radius:50%;"></div></div></div>`;

                    const marker = new google.maps.marker.AdvancedMarkerElement({
                        position: { lat: m.lat, lng: m.lng },
                        map: googleMapInstance.current,
                        content: dotWrapper,
                        zIndex: 90,
                        title: m.name
                    });
                    marker.addEventListener('gmp-click', () => onMarkerClick?.({ type: 'merchant', title: m.name, phone: m.phone, address: m.address, amount: m.amount || 0, isReady: m.isReady }));
                    shopMarkers.current.push(marker);
                    bounds.extend(new google.maps.LatLng(m.lat, m.lng));
                });

                if (!bounds.isEmpty()) googleMapInstance.current.fitBounds(bounds, { top: 100, bottom: 300, left: 50, right: 50 });

            } else if (currentRide.pickup_lat && currentRide.pickup_lng) {
                const passengerPos = { lat: currentRide.pickup_lat, lng: currentRide.pickup_lng };

                // Build a simple, reliable green SVG dot marker (works without mapId AdvancedMarker requirements)
                const greenDotSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52"><circle cx="20" cy="20" r="18" fill="#00E39A" opacity="0.18"/><circle cx="20" cy="20" r="11" fill="#00E39A" stroke="white" stroke-width="3"/><circle cx="16" cy="16" r="3.5" fill="white" opacity="0.45"/><line x1="20" y1="31" x2="20" y2="48" stroke="#00E39A" stroke-width="3" opacity="0.7"/><circle cx="20" cy="49" r="3" fill="#00E39A" opacity="0.6"/></svg>`;

                // Revoke old blob URL to avoid memory leak
                if (pickupSvgUrl.current) {
                    try { URL.revokeObjectURL(pickupSvgUrl.current); } catch (_) { }
                }
                const blob = new Blob([greenDotSVG], { type: 'image/svg+xml' });
                pickupSvgUrl.current = URL.createObjectURL(blob);

                const icon = {
                    url: pickupSvgUrl.current,
                    scaledSize: new google.maps.Size(40, 52),
                    anchor: new google.maps.Point(20, 49),
                };

                if (!passengerMarker.current) {
                    passengerMarker.current = new google.maps.Marker({
                        position: passengerPos,
                        map: googleMapInstance.current,
                        icon,
                        title: currentRide.passengerName || 'Pickup',
                        zIndex: 90
                    });
                    passengerMarker.current.addListener('click', () => {
                        onMarkerClick?.({
                            type: 'customer',
                            title: currentRide.passengerName,
                            phone: currentRide.passengerPhone,
                            address: currentRide.pickupLocation || currentRide.pickup_address
                        });
                    });
                } else {
                    passengerMarker.current.setPosition(passengerPos);
                    passengerMarker.current.setIcon(icon);
                    passengerMarker.current.setMap(googleMapInstance.current);
                }

                const bounds = new google.maps.LatLngBounds();
                bounds.extend(new google.maps.LatLng(profile.currentLat, profile.currentLng));
                bounds.extend(new google.maps.LatLng(passengerPos.lat, passengerPos.lng));
                googleMapInstance.current.fitBounds(bounds, { top: 100, bottom: 300, left: 50, right: 50 });
            }
        } else if (rideStatus !== 'NAVIGATING') {
            if (passengerMarker.current) {
                try { passengerMarker.current.setMap(null); } catch (_) { }
                passengerMarker.current = null;
            }
            shopMarkers.current.forEach(m => { try { m.setMap ? m.setMap(null) : (m.map = null); } catch (_) { } });
            shopMarkers.current = [];
        }

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation);
            cancelAnimationFrame(animationFrameId!);
        };
    }, [profile.currentLat, profile.currentLng, profile.isOnline, profile.vehicle?.type, isFollowing, currentRide, rideStatus]);


    // ─── EFFECT 2: Dropoff pins — fires immediately when rideStatus → NAVIGATING ─
    useEffect(() => {
        const google = (window as any).google;
        if (!googleMapInstance.current) return;

        // Clear previous dropoff markers
        dropoffMarkers.current.forEach(m => { try { m.map = null; } catch (_) { } });
        dropoffMarkers.current = [];

        // Clear pickup markers when trip starts
        if (rideStatus === 'NAVIGATING') {
            if (passengerMarker.current) {
                try { passengerMarker.current.setMap(null); } catch (_) { }
                passengerMarker.current = null;
            }
            shopMarkers.current.forEach(m => { try { m.setMap ? m.setMap(null) : (m.map = null); } catch (_) { } });
            shopMarkers.current = [];
        }

        if (rideStatus !== 'NAVIGATING' || !currentRide || !google?.maps?.marker?.AdvancedMarkerElement) return;

        const isMerchant = currentRide.type === 'MERCHANT_DELIVERY' || currentRide.ride_type === 'MERCHANT_DELIVERY';
        const hasImage = !!currentRide.passengerImage;
        const imgUrl = currentRide.passengerImage || '';
        const initial = currentRide.passengerName?.charAt(0)?.toUpperCase() || 'U';
        const color = isMerchant ? '#3B82F6' : '#EF4444';

        const makeDropoffPin = (label?: string) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.3));cursor:pointer;';
            const avatar = document.createElement('div');
            avatar.style.cssText = `width:44px;height:44px;background:white;border:3px solid ${color};border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;`;
            if (hasImage) {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                img.onerror = () => {
                    avatar.innerHTML = '';
                    const fb = document.createElement('div');
                    fb.style.cssText = `width:100%;height:100%;background:${color};display:flex;align-items:center;justify-content:center;`;
                    fb.innerHTML = `<span style="color:white;font-weight:900;font-size:18px;font-family:sans-serif;">${label || initial}</span>`;
                    avatar.appendChild(fb);
                };
                avatar.appendChild(img);
            } else {
                const fb = document.createElement('div');
                fb.style.cssText = `width:100%;height:100%;background:${color};display:flex;align-items:center;justify-content:center;`;
                fb.innerHTML = `<span style="color:white;font-weight:900;font-size:18px;font-family:sans-serif;">${label || initial}</span>`;
                avatar.appendChild(fb);
            }
            const stem = document.createElement('div');
            stem.style.cssText = `width:4px;height:10px;background:${color};border-radius:2px;`;
            const dot = document.createElement('div');
            dot.style.cssText = `width:12px;height:12px;background:${color};border-radius:50%;margin-top:-6px;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.2);`;
            wrapper.appendChild(avatar);
            wrapper.appendChild(stem);
            wrapper.appendChild(dot);
            return wrapper;
        };

        const bounds = new google.maps.LatLngBounds();
        if (profile.currentLat && profile.currentLng) bounds.extend(new google.maps.LatLng(profile.currentLat, profile.currentLng));

        // Multi-stop passenger ride
        const stopsArray = currentRide.stops && !isMerchant
            ? (typeof currentRide.stops === 'string' ? (() => { try { return JSON.parse(currentRide.stops); } catch { return []; } })() : currentRide.stops)
            : [];

        if (Array.isArray(stopsArray) && stopsArray.length > 0) {
            stopsArray.slice(0, 5).forEach((stop: any, idx: number) => {
                const lat = stop?.lat ?? stop?.dropoff_lat;
                const lng = stop?.lng ?? stop?.dropoff_lng;
                if (!lat || !lng) return;
                const pos = { lat: Number(lat), lng: Number(lng) };
                const marker = new google.maps.marker.AdvancedMarkerElement({ position: pos, map: googleMapInstance.current, content: makeDropoffPin(`${idx + 1}`), zIndex: 89 + idx, title: `Stop ${idx + 1}` });
                marker.addEventListener('gmp-click', () => onMarkerClick?.({ type: 'customer', title: currentRide.passengerName, phone: currentRide.passengerPhone, address: stop.address || stop.dropoff_address || '' }));
                dropoffMarkers.current.push(marker);
                bounds.extend(new google.maps.LatLng(lat, lng));
            });
        } else if (currentRide.dropoff_lat && currentRide.dropoff_lng) {
            const pos = { lat: Number(currentRide.dropoff_lat), lng: Number(currentRide.dropoff_lng) };
            const marker = new google.maps.marker.AdvancedMarkerElement({ position: pos, map: googleMapInstance.current, content: makeDropoffPin(), zIndex: 90, title: 'Dropoff' });
            marker.addEventListener('gmp-click', () => onMarkerClick?.({ type: 'customer', title: currentRide.passengerName, phone: currentRide.passengerPhone, address: currentRide.destination || currentRide.dropoff_address }));
            dropoffMarkers.current.push(marker);
            bounds.extend(new google.maps.LatLng(pos.lat, pos.lng));
        }

        if (!bounds.isEmpty()) googleMapInstance.current.fitBounds(bounds, { top: 100, bottom: 300, left: 50, right: 50 });

    }, [rideStatus, currentRide?.id, currentRide?.dropoff_lat, currentRide?.dropoff_lng]);


    // ─── EFFECT 3: Directions / Route Line ───────────────────────────────────
    useEffect(() => {
        if (!currentRide || (rideStatus !== 'ACCEPTED' && rideStatus !== 'ARRIVED' && rideStatus !== 'NAVIGATING')) {
            if (directionsRenderer.current) { try { directionsRenderer.current.setMap(null); } catch (_) { } }
            return;
        }

        const google = (window as any).google;
        if (!google?.maps || !googleMapInstance.current) return;

        if (!directionsService.current) directionsService.current = new google.maps.DirectionsService();
        if (!directionsRenderer.current) {
            directionsRenderer.current = new google.maps.DirectionsRenderer({
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: { strokeColor: '#00E39A', strokeWeight: 6, strokeOpacity: 0.92, zIndex: 10 }
            });
        }
        directionsRenderer.current.setMap(googleMapInstance.current);

        const origin = { lat: Number(profile.currentLat) || 13.4432, lng: Number(profile.currentLng) || -16.6776 };
        const isMerchantBatch = (currentRide.type === 'MERCHANT_DELIVERY' || currentRide.ride_type === 'MERCHANT_DELIVERY') && currentRide.merchants?.length > 0;

        let destination: any = null;
        let waypoints: any[] = [];

        if (rideStatus === 'NAVIGATING') {
            destination = currentRide.dropoff_lat && currentRide.dropoff_lng ? { lat: Number(currentRide.dropoff_lat), lng: Number(currentRide.dropoff_lng) } : null;
            const rawStops = currentRide.stops && !isMerchantBatch
                ? (typeof currentRide.stops === 'string' ? (() => { try { return JSON.parse(currentRide.stops); } catch { return []; } })() : currentRide.stops)
                : [];
            if (Array.isArray(rawStops) && rawStops.length > 0) {
                const valid = rawStops.slice(0, 5).map((s: any) => {
                    const lat = s?.lat ?? s?.dropoff_lat; const lng = s?.lng ?? s?.dropoff_lng;
                    return lat && lng ? { lat: Number(lat), lng: Number(lng) } : null;
                }).filter(Boolean) as { lat: number; lng: number }[];
                if (valid.length > 0) {
                    if (!destination) destination = valid[valid.length - 1];
                    waypoints = valid.slice(0, -1).map(loc => ({ location: loc, stopover: true }));
                }
            }
        } else if (isMerchantBatch) {
            destination = currentRide.dropoff_lat && currentRide.dropoff_lng ? { lat: Number(currentRide.dropoff_lat), lng: Number(currentRide.dropoff_lng) } : null;
            waypoints = currentRide.merchants.filter((m: any) => m.lat && m.lng).slice(0, 4).map((m: any) => ({ location: { lat: Number(m.lat), lng: Number(m.lng) }, stopover: true }));
        } else {
            destination = currentRide.pickup_lat && currentRide.pickup_lng ? { lat: Number(currentRide.pickup_lat), lng: Number(currentRide.pickup_lng) } : null;
        }

        if (!destination?.lat || !destination?.lng) return;

        directionsService.current.route(
            { origin, destination, waypoints, optimizeWaypoints: false, travelMode: google.maps.TravelMode.DRIVING, provideRouteAlternatives: false, unitSystem: google.maps.UnitSystem.METRIC },
            (result: any, status: any) => {
                if (status === 'OK' && directionsRenderer.current) {
                    directionsRenderer.current.setDirections(result);
                    const leg = result.routes[0]?.legs?.[0];
                    if (leg) setNavigationInfo({ distance: leg.distance?.text || '', duration: leg.duration?.text || '' });
                } else {
                    console.error('Directions failed:', status);
                }
            }
        );
    }, [rideStatus, currentRide?.id, profile.currentLat, profile.currentLng]);

    return { mapRef, googleMapInstance, driverMarker, passengerMarker, directionsRenderer, directionsService };
};
