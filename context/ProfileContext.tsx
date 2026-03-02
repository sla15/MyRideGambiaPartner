import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Role, UserProfile, RideRequest } from '../types';
import { INITIAL_PROFILE } from '../data/dummyData';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { initFCM } from '../utils/fcm';
import type { User } from '@supabase/supabase-js';

interface ProfileContextType {
    role: Role;
    setRole: (role: Role) => void;
    profile: UserProfile;
    setProfile: (profile: UserProfile) => void;
    updateProfile: (updates: Partial<UserProfile>) => void;
    isOnboarded: boolean;
    completeOnboarding: () => Promise<void>;
    secondaryOnboardingRole: Role | null;
    startSecondaryOnboarding: (role: Role) => void;
    cancelSecondaryOnboarding: () => void;
    toggleOnlineStatus: () => void;
    payCommission: () => void;
    uploadFile: (file: File, bucketOverride?: string, path?: string) => Promise<string | null>;
    loadUserData: (userId: string) => Promise<void>;
    syncProfile: (targetProfile?: UserProfile) => Promise<void>;
    updateActiveRole: (newRole: Role) => Promise<void>;
    rideStats: { completed: number };
    orderStats: { count: number; revenue: number };
    incomingRides: RideRequest[];
    setIncomingRides: React.Dispatch<React.SetStateAction<RideRequest[]>>;
    appSettings: {
        commission_percentage: number;
        max_driver_cash_amount: number;
        min_ride_price: number;
        min_delivery_fee: number;
        multiplier_scooter: number;
        multiplier_economy: number;
        multiplier_premium: number;
        currency_symbol: string;
        price_per_stop: number;
    };
    rejectedRideIds: Set<string>;
    setRejectedRideIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    isLocked: boolean;
    isLoading: boolean;
    requestAccountDeletion: () => Promise<{ success: boolean; error?: string }>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user: authUser } = useAuth();
    const { pushNotification } = useUI();
    const [user, setUser] = useState<User | null>(null); // Local user state
    const [role, setRole] = useState<Role>('DRIVER');
    const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
    const [isOnboarded, setIsOnboarded] = useState(true); // Start as true to prevent flash
    const [isLoading, setIsLoading] = useState(true); // NEW: Loading state for initialization
    const [secondaryOnboardingRole, setSecondaryOnboardingRole] = useState<Role | null>(null);
    const [rideStats, setRideStats] = useState({ completed: 0 });
    const [orderStats, setOrderStats] = useState({ count: 0, revenue: 0 });
    const [incomingRides, setIncomingRides] = useState<RideRequest[]>([]);
    const [rejectedRideIds, setRejectedRideIds] = useState<Set<string>>(new Set());

    const [appSettings, setAppSettings] = useState({
        commission_percentage: 15,
        max_driver_cash_amount: 3000,
        min_ride_price: 100,
        min_delivery_fee: 2,
        multiplier_scooter: 0.7,
        multiplier_economy: 1,
        multiplier_premium: 1.5,
        currency_symbol: 'D'
    });

    const uploadFile = async (file: File, bucketOverride?: string, path?: string): Promise<string | null> => {
        try {
            let bucket = bucketOverride;
            let uploadPath = path || `${Date.now()}_${file.name}`;

            if (!bucket) {
                if (role === 'DRIVER') bucket = 'driver_documents';
                else if (role === 'MERCHANT') bucket = 'business_documents';
                else bucket = 'profiles';
            }

            const { data, error } = await supabase.storage.from(bucket).upload(uploadPath, file, { upsert: true });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
            return publicUrl;
        } catch (err) {
            console.error(`Upload error:`, err);
            return null;
        }
    };

    const loadStats = useCallback(async (userId: string) => {
        try {
            // Driver Stats
            const { count: rideCount } = await supabase.from('rides').select('*', { count: 'exact', head: true }).eq('driver_id', userId).eq('status', 'completed');
            setRideStats({ completed: rideCount || 0 });

            // Merchant Stats
            const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', userId).maybeSingle();
            if (business) {
                const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
                // Total revenue only from COMPLETED orders for accuracy
                const { data: revenueData } = await supabase.from('orders').select('total_amount').eq('business_id', business.id).eq('status', 'completed');
                const totalRevenue = revenueData?.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0) || 0;
                setOrderStats({ count: orderCount || 0, revenue: totalRevenue });
            }
        } catch (err) {
            console.error("Error loading stats:", err);
        }
    }, []);

    const loadUserData = useCallback(async (userId: string) => {
        try {
            // Fetch everything in parallel
            const [
                profileRes,
                driverRes,
                merchantRes,
                walletRes,
                driverDocsRes,
                configRes
            ] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
                supabase.from('drivers').select('*').eq('id', userId).maybeSingle(),
                supabase.from('businesses').select('*').eq('owner_id', userId).maybeSingle(),
                supabase.from('wallets').select('*').eq('owner_id', userId).maybeSingle(),
                supabase.from('driver_documents').select('*').eq('driver_id', userId).maybeSingle(),
                supabase.from('app_settings').select('*').limit(1).maybeSingle()
            ]);

            const profileData = profileRes.data;
            if (!profileData) {
                setIsOnboarded(false);
                return;
            }

            const driverData = driverRes.data;
            const merchantData = merchantRes.data;
            const walletData = walletRes.data;
            const driverDocs = driverDocsRes.data;
            const config = configRes.data;

            if (config) {
                setAppSettings({
                    commission_percentage: Number(config.commission_percentage || 0),
                    max_driver_cash_amount: Number(config.max_driver_cash_amount || 0),
                    min_ride_price: Number(config.min_ride_price || 0),
                    min_delivery_fee: Number(config.min_delivery_fee || 0),
                    multiplier_scooter: Number(config.multiplier_scooter || 1),
                    multiplier_economy: Number(config.multiplier_economy || 1),
                    multiplier_premium: Number(config.multiplier_premium || 1.5),
                    currency_symbol: config.currency_symbol || 'D',
                    price_per_stop: Number(config.price_per_stop || 10)
                });
            }

            const vehicleCategoryMap: Record<string, string> = {
                'scooter': 'SCOOTER_TUKTUK',
                'economic': 'ECONOMIC',
                'premium': 'PREMIUM'
            };

            const hasDriverData = !!driverData?.vehicle_model;
            const hasMerchantData = !!merchantData;

            // Profile image serves as the Driver/User avatar. Business logo is separate.
            const displayImage = profileData.avatar_url;

            const mergedProfile: UserProfile = {
                name: profileData.full_name || '',
                phone: profileData.phone || '',
                email: profileData.email || '',
                age: profileData.age,
                gender: profileData.gender,
                image: displayImage,
                driverProfilePic: driverData?.profile_picture,
                rating: profileData.average_rating || 5.0,
                commissionDebt: driverData?.commission_debt || 0,
                walletBalance: walletData?.balance || 0,
                isOnline: driverData?.is_online || false,
                location: profileData.location,
                vehicle: driverData?.vehicle_model ? {
                    model: driverData.vehicle_model,
                    plate: driverData.vehicle_plate,
                    color: driverData.vehicle_color,
                    type: (vehicleCategoryMap[driverData.vehicle_category] || 'ECONOMIC') as any,
                    seats: driverData.vehicle_category === 'tuktuk' ? 2 : 4,
                    hasAC: driverData.vehicle_category === 'AC',
                    images: []
                } : profile.vehicle,
                business: merchantData ? {
                    id: merchantData.id,
                    businessName: merchantData.name,
                    category: merchantData.category || 'Restaurant',
                    logo: merchantData.image_url || '',
                    workingHours: merchantData.working_hours || { start: '09:00', end: '21:00' },
                    workingDays: merchantData.working_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    phone: profileData.phone || '',
                    eWallet: 'Wave',
                    subCategories: merchantData.sub_categories || [],
                    address: merchantData.location_address,
                    lat: merchantData.lat,
                    lng: merchantData.lng,
                    paymentPhone: merchantData.payment_phone || ''
                } : profile.business,
                documents: {
                    license: { url: driverDocs?.license_url || profile.documents.license?.url || '', status: (driverDocs?.status as any) || (profile.documents.license?.status) || 'MISSING' },
                    idCard: { url: driverDocs?.id_card_url || merchantData?.id_card_url || profile.documents.idCard?.url || '', status: (driverDocs?.status as any) || (profile.documents.idCard?.status) || 'MISSING' },
                    insurance: { url: driverDocs?.insurance_url || profile.documents.insurance?.url || '', status: (driverDocs?.status as any) || (profile.documents.insurance?.status) || 'MISSING' },
                    permit: { url: driverDocs?.permit_url || profile.documents.permit?.url || '', status: (driverDocs?.status as any) || (profile.documents.permit?.status) || 'MISSING' }
                },
                currentLat: driverData?.current_lat,
                currentLng: driverData?.current_lng,
                heading: driverData?.heading,
                isSuspended: driverData?.is_suspended || false
            };

            setProfile(mergedProfile);
            await loadStats(userId);

            // NEW: Fetch active ride for driver
            if (hasDriverData) {
                await fetchActiveRide(userId);
            }

            // Access Granted: if they are in drivers or businesses tables
            // This bypasses the need for user_roles table
            const isActuallyOnboarded = hasDriverData || hasMerchantData;
            setIsOnboarded(isActuallyOnboarded);

            // Determine active role
            if (profileData.active_role && ['DRIVER', 'MERCHANT', 'CUSTOMER'].includes(profileData.active_role)) {
                setRole(profileData.active_role as Role);
            } else if (hasDriverData && hasMerchantData) {
                setRole('DRIVER');
            } else if (hasDriverData) {
                setRole('DRIVER');
            } else if (hasMerchantData) {
                setRole('MERCHANT');
            } else {
                setRole('CUSTOMER');
            }

        } catch (err) {
            console.error("Error loading user data:", err);
            setIsOnboarded(false);
        }
    }, [loadStats]);

    const fetchActiveRide = useCallback(async (userId: string) => {
        try {
            const { data: activeRide, error } = await supabase
                .from('rides')
                .select('*')
                .eq('driver_id', userId)
                .in('status', ['accepted', 'arrived', 'in-progress'])
                .maybeSingle();

            if (activeRide) {
                const { data: userData } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url, average_rating, phone')
                    .eq('id', activeRide.customer_id)
                    .single();

                let merchants: any[] = [];
                if (activeRide.batch_id) {
                    const { data: batchOrders } = await supabase
                        .from('orders')
                        .select('total_amount, business_id, businesses(name, payment_phone, location_address)')
                        .eq('batch_id', activeRide.batch_id)
                        .in('status', ['accepted', 'preparing', 'ready', 'delivering']);

                    if (batchOrders) {
                        const mGrouped: Record<string, any> = {};
                        batchOrders.forEach(bo => {
                            const b = bo.businesses as any;
                            if (!mGrouped[bo.business_id]) {
                                mGrouped[bo.business_id] = {
                                    name: b?.name || 'Shop',
                                    phone: b?.business_phone || '',
                                    address: b?.location_address || '',
                                    amount: 0
                                };
                            }
                            mGrouped[bo.business_id].amount += parseFloat(bo.total_amount || '0');
                        });
                        merchants = Object.values(mGrouped);
                    }
                } else if (activeRide.stops && (activeRide.type === 'MERCHANT_DELIVERY' || activeRide.ride_type === 'MERCHANT_DELIVERY')) {
                    // Fallback for single orders: use the stops column which is JSONB or text[]
                    const stopsData = typeof activeRide.stops === 'string' ? JSON.parse(activeRide.stops) : activeRide.stops;
                    if (Array.isArray(stopsData)) {
                        merchants = stopsData.map((s: any) => {
                            // If it's already an object (JSONB), use it. 
                            // If it's a string, it might be a legacy address or a JSON string.
                            let parsed = s;
                            if (typeof s === 'string') {
                                try {
                                    parsed = JSON.parse(s);
                                } catch (e) {
                                    parsed = { business_address: s };
                                }
                            }
                            return {
                                name: parsed?.business_name || parsed?.name || 'Shop',
                                phone: parsed?.business_phone || parsed?.phone || parsed?.payment_phone || '',
                                address: parsed?.business_address || parsed?.address || '',
                                amount: parsed?.estimated_cash || 0
                            };
                        });
                    }
                }

                const newRideObj = {
                    id: activeRide.id,
                    customer_id: activeRide.customer_id,
                    passengerName: userData?.full_name || 'Customer',
                    passengerPhone: userData?.phone,
                    passengerImage: userData?.avatar_url,
                    passengerRating: userData?.average_rating || 5.0,
                    rating: userData?.average_rating || 5.0,
                    rideCount: 124, // Placeholder
                    pickupDistance: '0 km', // Will be updated by DriverHome or location sync
                    destination: activeRide.dropoff_address,
                    price: parseFloat(activeRide.price),
                    pickupLocation: activeRide.pickup_address,
                    pickup_lat: activeRide.pickup_lat,
                    pickup_lng: activeRide.pickup_lng,
                    dropoff_lat: activeRide.dropoff_lat,
                    dropoff_lng: activeRide.dropoff_lng,
                    type: activeRide.type,
                    created_at: activeRide.created_at,
                    total_cash_upfront: activeRide.total_cash_upfront,
                    stops: activeRide.stops,
                    merchants: merchants,
                    merchantPhone: merchants[0]?.phone,
                    businessName: merchants[0]?.name,
                    dbStatus: activeRide.status,
                    status: activeRide.status
                } as any;

                setIncomingRides(prev => {
                    if (prev.some(r => r.id === newRideObj.id)) return prev;
                    return [...prev, newRideObj];
                });
            }
        } catch (err) {
            console.error("Error fetching active ride:", err);
        }
    }, []);

    const updateActiveRole = async (newRole: Role) => {
        setRole(newRole);

        if (user) {
            await supabase.from('profiles').update({ active_role: newRole }).eq('id', user.id);
        }
    };

    useEffect(() => {
        // Handler for auth state changes
        const handleAuthChange = async (session: any) => {
            try {
                const currentUser = session?.user || null;
                setUser(currentUser);

                if (currentUser) {
                    // Centralized loading from primary tables
                    await loadUserData(currentUser.id);
                } else {
                    setIsOnboarded(false);
                    setIncomingRides([]);
                    setRole('CUSTOMER');
                }
            } catch (error) {
                console.error('Auth check error:', error);
                setIsOnboarded(false);
            } finally {
                setIsLoading(false);
            }
        };

        // Check session immediately on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleAuthChange(session);
        });

        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            handleAuthChange(session);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [loadUserData]);

    useEffect(() => {
        if (user) {
            // Initialize FCM and sync token to Supabase
            // Passing a callback for foreground notifications
            initFCM(user.id, (title, body, data) => {
                // Determine channel type: RIDE for ride requests, SYSTEM for others
                const channel = (data?.type === 'ride_request' || data?.ride_id) ? 'RIDE' : 'SYSTEM';
                pushNotification(title, body, channel);
            });
        } else {
            setIsOnboarded(false);
        }
    }, [user]);

    // Real-time Location Sync (watchPosition when online)
    const lastLocationUpdateTime = useRef<number>(0);
    useEffect(() => {
        let watchId: number | null = null;

        if (isOnboarded && role === 'DRIVER' && profile.isOnline && user) {
            if ("geolocation" in navigator) {
                watchId = navigator.geolocation.watchPosition(
                    async (position) => {
                        const { latitude, longitude, heading } = position.coords;

                        // Local state update for smooth map movement (UI only)
                        updateProfile({ currentLat: latitude, currentLng: longitude, heading: heading || 0 });

                        // Throttled DB Sync: Only every 10 seconds
                        const now = Date.now();
                        if (now - lastLocationUpdateTime.current > 10000) {
                            lastLocationUpdateTime.current = now;
                            await supabase.from('drivers').update({
                                current_lat: latitude,
                                current_lng: longitude,
                                heading: heading || 0,
                            }).eq('id', user.id);
                        }
                    },
                    (err) => console.error("Location watch error:", err),
                    { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
                );
            }
        }

        return () => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        };
    }, [isOnboarded, role, profile.isOnline, user]);

    // Compass/Device Orientation logic moved to DriverHome/Map for performance (prevent global re-renders)

    // Real-time Driver Status Sync (Handle DB Trigger Updates)
    const lastToggleTime = useRef<number>(0); // Moved here to be accessible by toggleOnlineStatus
    useEffect(() => {
        if (!user || role !== 'DRIVER') return;

        const channel = supabase
            .channel('public:drivers_status')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'drivers',
                filter: `id=eq.${user.id}`
            }, (payload) => {
                const newData = payload.new;
                // Ignore updates if a manual toggle was performed in the last 2 seconds (prevents flicker)
                if (Date.now() - lastToggleTime.current < 2000) return;

                if (newData) {
                    setProfile(prev => ({
                        ...prev,
                        isOnline: typeof newData.is_online === 'boolean' ? newData.is_online : prev.isOnline,
                        commissionDebt: typeof newData.commission_debt === 'number' ? newData.commission_debt : prev.commissionDebt,
                        isSuspended: typeof newData.is_suspended === 'boolean' ? newData.is_suspended : prev.isSuspended
                    }));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, role]);

    // Real-time Business Sync (for Merchants)
    useEffect(() => {
        if (!user || (role !== 'MERCHANT' && role !== 'BOTH')) return;

        const channel = supabase
            .channel('public:businesses_sync')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'businesses',
                filter: `owner_id=eq.${user.id}`
            }, (payload) => {
                const newData = payload.new;
                if (newData) {
                    setProfile(prev => ({
                        ...prev,
                        business: {
                            ...prev.business!,
                            businessName: newData.name,
                            category: newData.category,
                            address: newData.location_address,
                            logo: newData.image_url,
                            lat: newData.lat,
                            lng: newData.lng,
                            paymentPhone: newData.payment_phone,
                            subCategories: newData.sub_categories || []
                        }
                    }));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, role]);

    // Real-time Ride Request Listener (Tiered Dispatch / Expanding Radius)
    // Ref to prevent stale closures without re-triggering effect
    const profileRef = useRef(profile);
    const rejectedRideIdsRef = useRef(rejectedRideIds);

    useEffect(() => {
        profileRef.current = profile;
        rejectedRideIdsRef.current = rejectedRideIds;
    }, [profile, rejectedRideIds]);

    useEffect(() => {
        if (!user || role !== 'DRIVER' || !profile.isOnline) return;

        const driverVehicleType = profile.vehicle?.type;

        const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371; // km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        const channel = supabase
            .channel('public:rides_dispatch')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'rides'
            }, (payload) => {
                console.log("[ProfileContext] Realtime INSERT payload:", payload);
                const newRide = payload.new;

                if (newRide.status !== 'searching') {
                    console.log("[ProfileContext] Ignoring non-searching ride");
                    return;
                }

                const rideVehicleTypeMapping: Record<string, string> = {
                    'scooter': 'SCOOTER_TUKTUK',
                    'economic': 'ECONOMIC',
                    'premium': 'PREMIUM'
                };
                const rideType = rideVehicleTypeMapping[newRide.requested_vehicle_type] || 'ECONOMIC';

                const isEligibleForDelivery = newRide.type === 'DELIVERY' || newRide.type === 'MERCHANT_DELIVERY' || newRide.ride_type === 'MERCHANT_DELIVERY';

                const estCommission = (parseFloat(newRide.price || '0') * appSettings.commission_percentage) / 100;
                const currentProfile = profileRef.current;
                const isOverDebtLimit = (currentProfile.commissionDebt + estCommission) > appSettings.max_driver_cash_amount;
                const currentDriverVehicleType = currentProfile.vehicle?.type;

                if (!rejectedRideIdsRef.current.has(newRide.id) && !isOverDebtLimit && (rideType === currentDriverVehicleType || isEligibleForDelivery)) {
                    handleNewRide(newRide);
                } else if (isOverDebtLimit && isEligibleForDelivery) {
                    console.log("[ProfileContext] Ride blocked due to debt debt:", currentProfile.commissionDebt);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'rides'
            }, (payload) => {
                const updatedRide = payload.new;
                // If the updated ride is no longer searching, remove it from the queue
                if (updatedRide.status !== 'searching') {
                    setIncomingRides(prev => prev.filter(r => r.id !== updatedRide.id));
                } else {
                    // If it's still searching, check if we should show it (maybe it's a batch update)
                    const estCommission = (parseFloat(updatedRide.price || '0') * appSettings.commission_percentage) / 100;
                    const currentProfile = profileRef.current;
                    const isOverDebtLimit = (currentProfile.commissionDebt + estCommission) > appSettings.max_driver_cash_amount;

                    if (!rejectedRideIdsRef.current.has(updatedRide.id) && !isOverDebtLimit) {
                        handleNewRide(updatedRide);
                    }
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    fetchPendingRides();
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime channel error - connection may be unstable');
                }
            });

        const fetchPendingRides = async () => {
            const driverVehicleType = profile.vehicle?.type;
            const dbVehicleMapping: Record<string, string> = {
                'SCOOTER_TUKTUK': 'scooter',
                'ECONOMIC': 'economic',
                'PREMIUM': 'premium'
            };
            const dbType = dbVehicleMapping[driverVehicleType || 'ECONOMIC'] || 'economic';

            // Query for rides matching vehicle type OR any delivery ride
            const isDeliveryEligible = true; // All vehicles now eligible for delivery

            let query = supabase
                .from('rides')
                .select('*')
                .eq('status', 'searching');

            if (isDeliveryEligible) {
                // If delivery eligible, show rides of their type OR any delivery ride
                query = query.or(`requested_vehicle_type.eq.${dbType},type.eq.DELIVERY,type.eq.MERCHANT_DELIVERY,ride_type.eq.MERCHANT_DELIVERY`);
            } else {
                query = query.eq('requested_vehicle_type', dbType);
            }

            const { data: pendingRides } = await query
                .order('created_at', { ascending: false })
                .limit(10);

            if (pendingRides && pendingRides.length > 0) {
                pendingRides.forEach(ride => {
                    const estCommission = (parseFloat(ride.price || '0') * appSettings.commission_percentage) / 100;
                    const currentProfile = profileRef.current;
                    const isOverDebtLimit = (currentProfile.commissionDebt + estCommission) > appSettings.max_driver_cash_amount;

                    if (!rejectedRideIdsRef.current.has(ride.id) && !isOverDebtLimit) {
                        handleNewRide(ride);
                    }
                });
            }
        };

        const handleNewRide = (newRide: any) => {
            console.log("[ProfileContext] handleNewRide started for:", newRide.id);
            const startTime = new Date().getTime();

            // Interval to check distance with expanding radius
            const checkInterval = setInterval(async () => {
                const currentProfile = profileRef.current;
                // Default fallback location for testing if geolocation fails
                const lat = currentProfile.currentLat || 50.110924; // Frankfurt fallback
                const lng = currentProfile.currentLng || 8.682127;

                // Check if ride is still available
                const { data: currentRideStatus } = await supabase.from('rides').select('status').eq('id', newRide.id).single();
                if (currentRideStatus?.status !== 'searching') {
                    clearInterval(checkInterval);
                    return;
                }

                const distance = calculateDistance(
                    lat,
                    lng,
                    newRide.pickup_lat,
                    newRide.pickup_lng
                );

                const elapsedSeconds = (new Date().getTime() - startTime) / 1000;
                // For testing purposes, we expand the radius massively to ensure the driver receives the ride instantly regardless of testing distance
                const dynamicRadius = 99999;

                if (distance <= dynamicRadius) {
                    // Fetch real passenger data
                    const fetchPassenger = async () => {
                        const { data: userData } = await supabase
                            .from('profiles')
                            .select('full_name, avatar_url, average_rating, phone')
                            .eq('id', newRide.customer_id)
                            .single();

                        let merchants: any[] = [];
                        if (newRide.batch_id) {
                            const { data: batchOrders } = await supabase
                                .from('orders')
                                .select('total_amount, business_id, businesses(name, payment_phone, location_address)')
                                .eq('batch_id', newRide.batch_id)
                                .in('status', ['accepted', 'preparing', 'ready', 'delivering']);

                            if (batchOrders) {
                                const mGrouped: Record<string, any> = {};
                                batchOrders.forEach(bo => {
                                    const b = bo.businesses as any;
                                    if (!mGrouped[bo.business_id]) {
                                        mGrouped[bo.business_id] = {
                                            name: b?.name || 'Shop',
                                            phone: b?.business_phone || '',
                                            address: b?.location_address || '',
                                            amount: 0
                                        };
                                    }
                                    mGrouped[bo.business_id].amount += parseFloat(bo.total_amount || '0');
                                });
                                merchants = Object.values(mGrouped);
                            }
                        } else if (newRide.stops && (newRide.type === 'MERCHANT_DELIVERY' || newRide.ride_type === 'MERCHANT_DELIVERY')) {
                            // Fallback for single orders: use the stops column
                            const stopsData = typeof newRide.stops === 'string' ? JSON.parse(newRide.stops) : newRide.stops;
                            if (Array.isArray(stopsData)) {
                                merchants = stopsData.map((s: any) => {
                                    let parsed = s;
                                    if (typeof s === 'string') {
                                        try {
                                            parsed = JSON.parse(s);
                                        } catch (e) {
                                            parsed = { business_address: s };
                                        }
                                    }
                                    return {
                                        name: parsed?.business_name || parsed?.name || 'Shop',
                                        phone: parsed?.business_phone || parsed?.phone || parsed?.payment_phone || '',
                                        address: parsed?.business_address || parsed?.address || '',
                                        amount: parsed?.estimated_cash || 0
                                    }
                                });
                            }
                        }

                        const rideToAdd = {
                            id: newRide.id,
                            customer_id: newRide.customer_id,
                            passengerName: userData?.full_name || 'New Request',
                            passengerPhone: userData?.phone,
                            passengerImage: userData?.avatar_url,
                            passengerRating: userData?.average_rating || 5.0,
                            rating: userData?.average_rating || 5.0,
                            rideCount: 124,
                            pickupDistance: `${distance.toFixed(1)} km`,
                            destination: newRide.dropoff_address,
                            price: parseFloat(newRide.price),
                            pickupLocation: newRide.pickup_address,
                            pickup_lat: newRide.pickup_lat,
                            pickup_lng: newRide.pickup_lng,
                            dropoff_lat: newRide.dropoff_lat,
                            dropoff_lng: newRide.dropoff_lng,
                            type: newRide.type,
                            created_at: newRide.created_at,
                            total_cash_upfront: newRide.total_cash_upfront,
                            stops: newRide.stops,
                            merchants: merchants,
                            merchantPhone: merchants[0]?.phone,
                            businessName: merchants[0]?.name,
                            dbStatus: newRide.status,
                            status: newRide.status
                        } as any;

                        setIncomingRides(prev => {
                            if (prev.some(r => r.id === rideToAdd.id)) return prev;
                            // Add new rides at the end, but they are shown FIFO in the UI
                            return [...prev, rideToAdd];
                        });
                    };

                    fetchPassenger();
                    clearInterval(checkInterval);
                }

                // Stop checking after 60 seconds (dispatch timeout)
                if (elapsedSeconds > 60) clearInterval(checkInterval);
            }, 2000);
        };

        return () => {
            try {
                supabase.removeChannel(channel);
            } catch (error) {
                console.error('Error removing channel:', error);
            }
        };
    }, [user, role, profile.isOnline, profile.vehicle?.type]);

    const completeOnboarding = async (targetProfile?: UserProfile) => {
        // Fix for TypeError: merge with current profile to ensure 'documents' and other required fields exist
        const activeProfile = targetProfile ? { ...profile, ...targetProfile } : profile;
        if (!user) {
            setIsOnboarded(true);
            return;
        }

        try {
            // Determine the final role (driver, merchant, or both)
            let finalRole = role.toLowerCase();
            const { data: profileCheck } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
            const existingRole = profileCheck?.role;

            if (existingRole === 'both' || secondaryOnboardingRole || (activeProfile.vehicle && activeProfile.business) || (existingRole === 'driver' && activeProfile.business) || (existingRole === 'merchant' && activeProfile.vehicle)) {
                finalRole = 'both';
            } else {
                if (activeProfile.vehicle) finalRole = 'driver';
                else if (activeProfile.business) finalRole = 'merchant';
            }

            // 1. Sync Base Profile using upsert to handle cases where trigger didn't create the row
            const { error: profileError } = await supabase.from('profiles').upsert({
                id: user.id,
                full_name: activeProfile.name || (user.user_metadata?.full_name),
                phone: activeProfile.phone || user.phone,
                role: finalRole as any,
                active_role: finalRole === 'both' ? 'DRIVER' : finalRole.toUpperCase()
            }, { onConflict: 'id' });
            if (profileError) throw profileError;

            // 2. Sync Driver Data if exists
            if (activeProfile.vehicle) {
                const vehicleMapping: Record<string, string> = {
                    'SCOOTER_TUKTUK': 'scooter',
                    'ECONOMIC': 'economic',
                    'PREMIUM': 'premium'
                };

                const categoryValue = vehicleMapping[activeProfile.vehicle?.type || 'ECONOMIC'] || 'economic';

                const { error: driverError } = await supabase.from('drivers').upsert({
                    id: user.id,
                    vehicle_model: activeProfile.vehicle?.model,
                    vehicle_plate: activeProfile.vehicle?.plate,
                    vehicle_color: activeProfile.vehicle?.color,
                    vehicle_category: categoryValue as any,
                    is_online: activeProfile.isOnline,
                    approval_status: 'pending',
                    submitted_at: new Date().toISOString()
                }, { onConflict: 'id' });
                if (driverError) console.error("Driver Sync Error:", driverError);

                if (activeProfile.documents?.license?.url || activeProfile.documents?.idCard?.url || activeProfile.documents?.insurance?.url) {
                    const { error: docsError } = await supabase.from('driver_documents').upsert({
                        driver_id: user.id,
                        id_card_url: activeProfile.documents.idCard?.url || null,
                        drivers_license_url: activeProfile.documents.license?.url || null,
                        vehicle_insurance_url: activeProfile.documents.insurance?.url || null,
                        status: 'pending'
                    }, { onConflict: 'driver_id' });
                    if (docsError) console.error("Driver Docs Sync Error:", docsError);
                }
            }

            if (activeProfile.business) {
                const { error: businessError } = await supabase.from('businesses').upsert({
                    owner_id: user.id,
                    name: activeProfile.business?.businessName || 'Unnamed Business',
                    category: activeProfile.business?.category,
                    location_address: activeProfile.business?.address,
                    image_url: activeProfile.business?.logo,
                    lat: activeProfile.business?.lat,
                    lng: activeProfile.business?.lng,
                    payment_phone: activeProfile.business?.paymentPhone,
                    sub_categories: activeProfile.business?.subCategories || [],
                    submitted_at: new Date().toISOString(),
                    approval_status: 'pending'
                }, { onConflict: 'owner_id' });
                if (businessError) console.error("Business Sync Error:", businessError);

                // TURN OFF Driver status when becoming a Merchant
                const { error: offlineError } = await supabase.from('drivers').update({ is_online: false }).eq('id', user.id);
                if (offlineError) console.error("Error turning off driver status:", offlineError);

                if (activeProfile.documents?.idCard?.url) {
                    const { error: merchDocError } = await supabase.from('merchant_documents').upsert({
                        merchant_id: user.id,
                        id_card_url: activeProfile.documents?.idCard?.url,
                        status: 'pending'
                    }, { onConflict: 'merchant_id' });
                    if (merchDocError) console.error("Merchant Doc Sync Error:", merchDocError);
                }
            }

            setIsOnboarded(true);
            setSecondaryOnboardingRole(null);
            await loadUserData(user.id);
        } catch (err) {
            console.error("Onboarding Sync Error:", err);
            // Don't set onboarded true on error to allow retry
        }
    };

    const syncProfile = async (targetProfile: UserProfile = profile) => {
        if (!user) return;

        try {
            // Ensure targetProfile has all necessary fields by merging with current profile
            const activeProfile = { ...profile, ...targetProfile };

            const { error: profileError } = await supabase.from('profiles').update({
                full_name: activeProfile.name,
                avatar_url: activeProfile.image, // Strictly Driver/User avatar
                location: activeProfile.location,
            }).eq('id', user.id);
            if (profileError) throw profileError;

            // 2. Sync Driver Data if exists
            if (activeProfile.vehicle) {
                const vehicleMapping: Record<string, string> = {
                    'SCOOTER_TUKTUK': 'scooter',
                    'ECONOMIC': 'economic',
                    'PREMIUM': 'premium'
                };
                const { error: driverError } = await supabase.from('drivers').upsert({
                    id: user.id,
                    vehicle_model: activeProfile.vehicle.model,
                    vehicle_plate: activeProfile.vehicle.plate,
                    vehicle_color: activeProfile.vehicle.color,
                    vehicle_category: (vehicleMapping[activeProfile.vehicle.type] || 'economic') as any,
                    is_online: activeProfile.isOnline,
                    profile_picture: activeProfile.driverProfilePic
                }, { onConflict: 'id' });
                if (driverError) console.error("Driver Sync Error:", driverError);

                // Sync Driver Docs
                if (activeProfile.documents?.license?.url || activeProfile.documents?.idCard?.url || activeProfile.documents?.insurance?.url) {
                    await supabase.from('driver_documents').upsert({
                        driver_id: user.id,
                        id_card_url: activeProfile.documents.idCard?.url || null,
                        drivers_license_url: activeProfile.documents.license?.url || null,
                        vehicle_insurance_url: activeProfile.documents.insurance?.url || null,
                    }, { onConflict: 'driver_id' });
                }
            }

            // 3. Sync Merchant Data if exists
            if (activeProfile.business) {
                const { error: businessError } = await supabase.from('businesses').upsert({
                    owner_id: user.id,
                    name: activeProfile.business.businessName,
                    category: activeProfile.business.category,
                    location_address: activeProfile.business.address,
                    image_url: activeProfile.business.logo,
                    lat: activeProfile.business.lat,
                    lng: activeProfile.business.lng,
                    payment_phone: activeProfile.business.paymentPhone,
                    sub_categories: activeProfile.business.subCategories || [],
                    working_hours: activeProfile.business.workingHours,
                    working_days: activeProfile.business.workingDays
                }, { onConflict: 'owner_id' });
                if (businessError) console.error("Business Sync Error:", businessError);

                // Sync Merchant Doc (ID Card only)
                if (activeProfile.documents?.idCard?.url) {
                    await supabase.from('merchant_documents').upsert({
                        merchant_id: user.id,
                        id_card_url: activeProfile.documents?.idCard?.url,
                    }, { onConflict: 'merchant_id' });
                }
            }
        } catch (err) {
            console.error("Profile Sync Error:", err);
        }
    };

    const updateProfile = (updates: Partial<UserProfile>) => setProfile(prev => ({ ...prev, ...updates }));

    const toggleOnlineStatus = async () => {
        if (!user) return;

        const newStatus = !profile.isOnline;
        lastToggleTime.current = Date.now();

        // Optimistic local update
        setProfile(prev => ({ ...prev, isOnline: newStatus }));

        try {
            const { error } = await supabase.from('drivers').update({ is_online: newStatus }).eq('id', user.id);
            if (error) {
                // Rollback on error
                setProfile(prev => ({ ...prev, isOnline: !newStatus }));
                console.error("Failed to toggle status:", error);
            }
        } catch (err) {
            setProfile(prev => ({ ...prev, isOnline: !newStatus }));
        }
    };
    const { showAlert } = useUI();

    const payCommission = async () => {
        if (!user || profile.commissionDebt <= 0) return;
        const amountToPay = profile.commissionDebt;

        try {
            // 1. Call Supabase Edge Function to Create Wave Session
            const { data, error } = await supabase.functions.invoke('create-wave-checkout', {
                body: {
                    amount: amountToPay,
                    driverId: user.id
                }
            });

            if (error) throw error;
            if (!data?.checkout_url) throw new Error("No checkout URL returned");

            // 2. Open Wave Checkout
            window.open(data.checkout_url, '_blank');

            // 3. User feedback
            console.log("Redirected to Wave Checkout:", data.checkout_url);

        } catch (err: any) {
            console.error("Error initiating Wave payment:", err);

            // Simplified Grammar (Grade 5)
            const simplifiedMessage = "Sorry, we couldn't start the payment right now. " +
                "If Wave is not working, you can pay at our office or use our Wave business number.";

            showAlert("Payment Error", simplifiedMessage);
        }
    };

    const requestAccountDeletion = async () => {
        if (!user) return { success: false, error: 'User not authenticated' };

        const timestamp = new Date().toISOString();
        const { error } = await supabase
            .from('profiles')
            .update({
                deletion_requested_at: timestamp,
                deleted_at: timestamp
            })
            .eq('id', user.id);

        if (error) {
            console.error('Error requesting account deletion:', error);
            return { success: false, error: error.message };
        }

        // Locally update profile state
        setProfile(prev => ({
            ...prev,
            deletion_requested_at: timestamp,
            deleted_at: timestamp
        }));
        return { success: true };
    };

    const signOut = async () => {
        setIncomingRides([]);
        await supabase.auth.signOut();
    };

    return (
        <ProfileContext.Provider value={{
            role, setRole, profile, setProfile, updateProfile, isOnboarded, completeOnboarding: (p?: UserProfile) => completeOnboarding(p),
            secondaryOnboardingRole, startSecondaryOnboarding: (r) => { setRole(r); setSecondaryOnboardingRole(r); },
            cancelSecondaryOnboarding: () => {
                setSecondaryOnboardingRole(null);
                if (profile.business && !profile.vehicle) setRole('MERCHANT');
                else if (profile.vehicle && !profile.business) setRole('DRIVER');
            },
            toggleOnlineStatus, payCommission, signOut, uploadFile, loadUserData, syncProfile, updateActiveRole,
            requestAccountDeletion,
            rideStats, orderStats, incomingRides, setIncomingRides,
            rejectedRideIds, setRejectedRideIds,
            appSettings,
            isLocked: (profile.commissionDebt > appSettings.max_driver_cash_amount) || profile.isSuspended,
            isLoading
        }}>
            {children}
        </ProfileContext.Provider>
    );
};

export const useProfile = () => {
    const context = useContext(ProfileContext);
    if (context === undefined) throw new Error('useProfile must be used within a ProfileProvider');
    return context;
};
