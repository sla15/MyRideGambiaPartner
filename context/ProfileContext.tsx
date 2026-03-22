import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Role, UserProfile, RideRequest } from '../types';
import { INITIAL_PROFILE } from '../data/dummyData';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useDomain } from './DomainContext';
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
    uploadFile: (file: File | Blob, bucketOverride?: string, path?: string) => Promise<string | null>;

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
        min_partner_app_version: string;
        latest_partner_app_version: string;
        update_url_partner_android: string;
        update_url_partner_ios: string;
    };
    rejectedRideIds: Set<string>;
    setRejectedRideIds: (id: string) => void;
    isLocked: boolean;
    lockReason: 'DEBT_LIMIT' | 'SUSPENDED' | null;
    isLoading: boolean;
    requestAccountDeletion: () => Promise<{ success: boolean; error?: string }>;
    submitManualPayment: (method: 'WAVE_MANUAL' | 'OFFICE', transactionId?: string) => Promise<{ success: boolean; error?: string }>;
    pendingManualPayment: { amount: number; method: string; createdAt: string } | null;
    signOut: () => Promise<void>;
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
    const [pendingManualPayment, setPendingManualPayment] = useState<{ amount: number; method: string; createdAt: string } | null>(null);

    const [appSettings, setAppSettings] = useState({
        commission_percentage: 15,
        max_driver_cash_amount: 3000,
        min_ride_price: 100,
        min_delivery_fee: 2,
        multiplier_scooter: 0.7,
        multiplier_economy: 1,
        multiplier_premium: 1.5,
        currency_symbol: 'D',
        min_partner_app_version: '1.0.0',
        latest_partner_app_version: '1.0.0',
        update_url_partner_android: 'https://play.google.com/store/apps/details?id=com.dropoffgambia.partner',
        update_url_partner_ios: ''
    });

    const { currentRide, setCurrentRide } = useDomain() || {};

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

    const uploadFile = async (file: File | Blob, bucketOverride?: string, path?: string): Promise<string | null> => {
        try {
            let bucket = bucketOverride;
            const fileName = (file as File).name || 'upload';
            let uploadPath = path || `${Date.now()}_${fileName}`;


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
                    price_per_stop: Number(config.price_per_stop || 10),
                    min_partner_app_version: config.min_partner_app_version || '1.0.0',
                    latest_partner_app_version: config.latest_partner_app_version || '1.0.0',
                    update_url_partner_android: config.update_url_partner_android || 'https://play.google.com/store/apps/details?id=com.dropoffgambia.partner',
                    update_url_partner_ios: config.update_url_partner_ios || ''
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

            // Fetch most recent manual payment to handle cooldown and pending status
            const { data: manualPayments } = await supabase
                .from('manual_payments')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (manualPayments && manualPayments.length > 0) {
                const latest = manualPayments[0];
                const createdTime = new Date(latest.created_at).getTime();
                const isRecent = (Date.now() - createdTime) < 5 * 60 * 1000;
                
                // Set pendingManualPayment if it's PENDING OR if it's recent (for cooldown timer)
                if (latest.status === 'PENDING' || isRecent) {
                    setPendingManualPayment({
                        amount: latest.amount,
                        method: latest.payment_method,
                        createdAt: latest.created_at,
                        status: latest.status
                    });
                } else {
                    setPendingManualPayment(null);
                }
            } else {
                setPendingManualPayment(null);
            }

            // Check for suspension change to trigger notification
            const wasLocked = (profile.commissionDebt >= appSettings.max_driver_cash_amount) || profile.isSuspended;
            const isNowLocked = (mergedProfile.commissionDebt >= appSettings.max_driver_cash_amount) || mergedProfile.isSuspended;

            if (!wasLocked && isNowLocked) {
                pushNotification("Account Suspended", "Your account has been suspended due to debt limit. Please make a payment to continue.", "SYSTEM");
            } else if (wasLocked && !isNowLocked) {
                pushNotification("Account Unsuspended", "Your account has been unsuspended. You can now receive new ride requests.", "SYSTEM");
            }

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
                        .select('total_amount, business_id, status, businesses(name, payment_phone, location_address, image_url, lat, lng)')
                        .eq('batch_id', activeRide.batch_id)
                        .in('status', ['accepted', 'preparing', 'ready', 'delivering']);

                    if (batchOrders) {
                        const mGrouped: Record<string, any> = {};
                        batchOrders.forEach(bo => {
                            const b = bo.businesses as any;
                            if (!mGrouped[bo.business_id]) {
                                mGrouped[bo.business_id] = {
                                    name: b?.name || 'Shop',
                                    phone: b?.payment_phone || '',
                                    address: b?.location_address || '',
                                    image: b?.image_url || null,
                                    lat: b?.lat,
                                    lng: b?.lng,
                                    amount: 0,
                                    isReady: ['ready', 'delivering', 'arrived', 'completed'].includes(bo.status)
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
                                phone: parsed?.payment_phone || parsed?.phone || '',
                                address: parsed?.business_address || parsed?.address || '',
                                amount: parsed?.estimated_cash || 0,
                                lat: parsed?.lat,
                                lng: parsed?.lng,
                                isReady: ['ready', 'delivering', 'arrived', 'completed'].includes(parsed?.status)
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
                    setProfile(INITIAL_PROFILE);
                    setRideStats({ completed: 0 });
                    setOrderStats({ count: 0, revenue: 0 });
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
                
                // Also show a direct alert if it's a ride/order request so it's not missed
                if (channel === 'RIDE' || data?.type === 'order_request') {
                    showAlert(title, body, () => {
                        // Optional: navigate to home/wallet if needed
                    }, "View");
                }
            });

        } else {
            setIsOnboarded(false);
        }
    }, [user]);

    // Real-time Location Sync (watchPosition when online)
    const lastLocationUpdateTime = useRef<number>(0);
    useEffect(() => {
        let watchId: string | null = null;

        const startWatching = async () => {
            if (isOnboarded && role === 'DRIVER' && profile.isOnline && user) {
                try {
                    // Check and request permissions first
                    const permissions = await Geolocation.checkPermissions();
                    if (permissions.location !== 'granted') {
                        const request = await Geolocation.requestPermissions();
                        if (request.location !== 'granted') {
                            console.warn("Location permission not granted");
                            return;
                        }
                    }

                    watchId = await Geolocation.watchPosition(
                        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
                        async (position, err) => {
                            if (err) {
                                console.error("Location watch error:", err);
                                return;
                            }
                            if (!position) return;

                            const { latitude, longitude, heading } = position.coords;

                            // Local state update for smooth map movement (UI only)
                            updateProfile({ currentLat: latitude, currentLng: longitude, heading: heading || 0 });

                            // Throttled DB Sync: Only every 20 seconds for partner app (saves battery/data)
                            const now = Date.now();
                            const isLowEnd = (navigator.hardwareConcurrency || 4) <= 2;
                            const syncThreshold = isLowEnd ? 30000 : 15000;
                            
                            if (now - lastLocationUpdateTime.current > syncThreshold) {
                                lastLocationUpdateTime.current = now;
                                await supabase.from('drivers').update({
                                    current_lat: latitude,
                                    current_lng: longitude,
                                    heading: heading || 0,
                                }).eq('id', user.id);
                            }
                        }
                    );
                } catch (err) {
                    console.error("Error starting location watch:", err);
                }
            }
        };

        startWatching();

        return () => {
            if (watchId !== null) {
                Geolocation.clearWatch({ id: watchId });
            }
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

    // Real-time Manual Payment Sync (for automatic UI reset)
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`manual_payments_sync_${user.id}`)
            .on('postgres_changes', {
                event: '*', // Listen for all changes (INSERT for new submissions, UPDATE for admin approval)
                schema: 'public',
                table: 'manual_payments',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                console.log("[ProfileContext] Manual Payment change detected:", payload);
                // Refresh user data (commission debt, etc.) when a payment is updated or added
                loadUserData(user.id);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, loadUserData]);

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
    }, [profile]);

    const addToRejectedRides = useCallback((id: string) => {
        console.log("[ProfileContext] Adding to rejected rides:", id);
        setRejectedRideIds(prev => {
            const next = new Set(prev).add(id);
            rejectedRideIdsRef.current = next;
            return next;
        });
    }, []);

    useEffect(() => {
        if (!user || role !== 'DRIVER' || !profile.isOnline) return;

        const driverVehicleType = profile.vehicle?.type;

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
                const isOverDebtLimit = (currentProfile.commissionDebt + estCommission) >= appSettings.max_driver_cash_amount;
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
                    const isOverDebtLimit = (currentProfile.commissionDebt + estCommission) >= appSettings.max_driver_cash_amount;

                    if (!rejectedRideIdsRef.current.has(updatedRide.id) && !isOverDebtLimit) {
                        handleNewRide(updatedRide); // This will now update the ride if it exists
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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, role, profile.isOnline, profile.vehicle?.type]);

    // Listener for active ride order status changes (to update Yellow/Green dots)
    useEffect(() => {
        if (!user || role !== 'DRIVER' || !currentRide?.batch_id) return;

        const channel = supabase
            .channel(`active_ride_orders_${currentRide.batch_id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `batch_id=eq.${currentRide.batch_id}`
            }, async () => {
                // When any order in the batch is updated, refresh the merchants data for the current ride
                handleNewRide(currentRide);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, role, currentRide?.batch_id, currentRide?.id]);

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
                const isOverDebtLimit = (currentProfile.commissionDebt + estCommission) >= appSettings.max_driver_cash_amount;

                if (!rejectedRideIdsRef.current.has(ride.id) && !isOverDebtLimit) {
                    handleNewRide(ride);
                }
            });
        }
    };

    const activeSearchesRef = useRef<Map<string, () => void>>(new Map());

    const handleNewRide = (newRide: any) => {
        if (activeSearchesRef.current.has(newRide.id)) {
            return;
        }

        console.log("[ProfileContext] handleNewRide started for:", newRide.id);
        const startTime = new Date().getTime();

        // 1. Subscribe to status updates to stop searching if ride is taken/cancelled
        // Removed per-ride statusChannel, relying on global UPDATE listener instead.

        let checkInterval: any = null;

        const cleanup = () => {
            if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
            }
            activeSearchesRef.current.delete(newRide.id);
        };

        activeSearchesRef.current.set(newRide.id, cleanup);

        // 2. Interval for distance check and radius expansion (No DB status polling)
        checkInterval = setInterval(async () => {
            const currentProfile = profileRef.current;
            const lat = currentProfile.currentLat || 50.110924;
            const lng = currentProfile.currentLng || 8.682127;

            const distance = calculateDistance(lat, lng, newRide.pickup_lat, newRide.pickup_lng);
            const elapsedSeconds = (new Date().getTime() - startTime) / 1000;

            // Expand radius: Start logic (1km default, expanding every 15s)
            // Match user request: "search for driver within 1km and it will increase until it hit where the driver_search_radius_km is set"
            const searchLimit = appSettings.driver_search_radius_km || 10;
            const dynamicRadius = Math.min(1 + Math.floor(elapsedSeconds / 15), searchLimit);

            // Special case logic for merchant delivery noted by user
            const isMerchantDelivery = newRide.type === 'MERCHANT_DELIVERY' || newRide.ride_type === 'MERCHANT_DELIVERY';
            const distanceEligible = isMerchantDelivery || (distance <= dynamicRadius);

            if (distanceEligible) {
                // Check status one last time before fetching details to avoid redundant network load
                // Removed single-fetch status check, relying on global UPDATE listener for status changes.

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
                            .select('status, total_amount, business_id, businesses(name, payment_phone, location_address, image_url, lat, lng)')
                            .eq('batch_id', newRide.batch_id)
                            .in('status', ['accepted', 'preparing', 'ready', 'delivering', 'completed']);

                        if (batchOrders) {
                            const mGrouped: Record<string, any> = {};
                            batchOrders.forEach(bo => {
                                const b = bo.businesses as any;
                                if (!mGrouped[bo.business_id]) {
                                    mGrouped[bo.business_id] = {
                                        id: bo.business_id,
                                        name: b?.name || 'Shop',
                                        phone: b?.payment_phone || '',
                                        address: b?.location_address || '',
                                        image: b?.image_url || null,
                                        lat: b?.lat,
                                        lng: b?.lng,
                                        amount: 0,
                                        isReady: ['ready', 'delivering', 'arrived', 'completed'].includes(bo.status)
                                    };
                                }
                                mGrouped[bo.business_id].amount += parseFloat(bo.total_amount || '0');
                                if (!['ready', 'delivering', 'arrived', 'completed'].includes(bo.status)) {
                                    mGrouped[bo.business_id].isReady = false;
                                }
                            });
                            merchants = Object.values(mGrouped);
                        }
                    } else if (newRide.stops && (newRide.type === 'MERCHANT_DELIVERY' || newRide.ride_type === 'MERCHANT_DELIVERY')) {
                        const stopsData = typeof newRide.stops === 'string' ? JSON.parse(newRide.stops) : newRide.stops;
                        if (Array.isArray(stopsData)) {
                            merchants = stopsData.map((s: any) => {
                                let parsed = s;
                                if (typeof s === 'string') {
                                    try { parsed = JSON.parse(s); } catch (e) { parsed = { business_address: s }; }
                                }
                                return {
                                    name: parsed?.business_name || parsed?.name || 'Shop',
                                    phone: parsed?.payment_phone || parsed?.phone || '',
                                    address: parsed?.business_address || parsed?.address || '',
                                    image: parsed?.image_url || null,
                                    lat: parsed?.lat,
                                    lng: parsed?.lng,
                                    amount: parsed?.estimated_cash || 0,
                                    isReady: ['ready', 'arrived', 'delivering', 'completed'].includes(parsed?.status || 'preparing')
                                };
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
                        batch_id: newRide.batch_id
                    } as any;

                    setIncomingRides(prev => {
                        // DO NOT add if it was rejected while we were fetching passenger details
                        if (rejectedRideIdsRef.current.has(rideToAdd.id)) {
                            return prev;
                        }

                        const existingIndex = prev.findIndex(r => r.id === rideToAdd.id);
                        if (existingIndex !== -1) {
                            const updated = [...prev];
                            updated[existingIndex] = rideToAdd;
                            return updated;
                        }
                        return [...prev, rideToAdd];
                    });

                    // Only set as current ride if it wasn't rejected
                    if (currentRide?.id === rideToAdd.id && !rejectedRideIdsRef.current.has(rideToAdd.id)) {
                        setCurrentRide(rideToAdd);
                    }
                };

                fetchPassenger();
                cleanup(); // Found and fetched, stop the interval
            }

            if (elapsedSeconds > 300) cleanup(); // Timeout after 5 mins
        }, 3000);
    };

    useEffect(() => {
        if (!user || role !== 'DRIVER' || !profile.isOnline) return;

        const driverVehicleType = profile.vehicle?.type;

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
                const isOverDebtLimit = (currentProfile.commissionDebt + estCommission) >= appSettings.max_driver_cash_amount;
                const currentDriverVehicleType = currentProfile.vehicle?.type;

                if (!rejectedRideIdsRef.current.has(newRide.id) && !isOverDebtLimit && (rideType === currentDriverVehicleType || isEligibleForDelivery)) {
                    handleNewRide(newRide);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'rides'
            }, (payload) => {
                const updatedRide = payload.new;
                // If the updated ride is no longer searching, remove it from the queue and stop search intervals
                if (updatedRide.status !== 'searching') {
                    const searchCleanup = activeSearchesRef.current.get(updatedRide.id);
                    if (searchCleanup) searchCleanup();
                    setIncomingRides(prev => prev.filter(r => r.id !== updatedRide.id));
                } else {
                    const estCommission = (parseFloat(updatedRide.price || '0') * appSettings.commission_percentage) / 100;
                    const currentProfile = profileRef.current;
                    const isOverDebtLimit = (currentProfile.commissionDebt + estCommission) >= appSettings.max_driver_cash_amount;

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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, role, profile.isOnline, profile.vehicle?.type]);

    // Listener for active ride order status changes (to update Yellow/Green dots)
    useEffect(() => {
        if (!user || role !== 'DRIVER' || !currentRide?.batch_id) return;

        const channel = supabase
            .channel(`active_ride_orders_${currentRide.batch_id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `batch_id=eq.${currentRide.batch_id}`
            }, async () => {
                // When any order in the batch is updated, refresh the merchants data for the current ride
                handleNewRide(currentRide);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, role, currentRide?.batch_id, currentRide?.id]);

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
                    approval_status: 'approved',
                    submitted_at: new Date().toISOString()
                }, { onConflict: 'id' });
                if (driverError) console.error("Driver Sync Error:", driverError);

                if (activeProfile.documents?.license?.url || activeProfile.documents?.idCard?.url || activeProfile.documents?.insurance?.url) {
                    const { error: docsError } = await supabase.from('driver_documents').upsert({
                        driver_id: user.id,
                        id_card_url: activeProfile.documents.idCard?.url || null,
                        drivers_license_url: activeProfile.documents.license?.url || null,
                        vehicle_insurance_url: activeProfile.documents.insurance?.url || null,
                        status: 'approved'
                    }, { onConflict: 'driver_id' });
                    if (docsError) console.error("Driver Docs Sync Error:", docsError);
                }
            }

            if (activeProfile.business) {
                const { error: businessError } = await supabase.from('businesses').upsert({
                    id: activeProfile.business.id, // Include ID to prevent duplicates
                    owner_id: user.id,
                    name: activeProfile.business?.businessName || 'Unnamed Business',
                    category: activeProfile.business?.category,
                    location_address: activeProfile.business?.address,
                    image_url: activeProfile.business?.logo,
                    lat: activeProfile.business?.lat,
                    lng: activeProfile.business?.lng,
                    payment_phone: activeProfile.business?.payment_phone || activeProfile.business?.paymentPhone,
                    sub_categories: activeProfile.business?.subCategories || [],
                    submitted_at: new Date().toISOString(),
                    approval_status: 'approved'
                }, { onConflict: 'owner_id' });
                if (businessError) console.error("Business Sync Error:", businessError);

                // TURN OFF Driver status when becoming a Merchant
                const { error: offlineError } = await supabase.from('drivers').update({ is_online: false }).eq('id', user.id);
                if (offlineError) console.error("Error turning off driver status:", offlineError);

                if (activeProfile.documents?.idCard?.url) {
                    const { error: merchDocError } = await supabase.from('merchant_documents').upsert({
                        merchant_id: user.id,
                        id_card_url: activeProfile.documents?.idCard?.url,
                        status: 'approved'
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
                    id: activeProfile.business.id, // Include ID to prevent duplicates
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

        // Bypassing Wave API for now as requested
        showAlert(
            "Payment Options",
            "Automatic Wave payment is currently unavailable. How would you like to pay?",
            () => {
                // Navigate or show manual payment UI
                window.dispatchEvent(new CustomEvent('open-manual-payment'));
            },
            "Manual Wave Pay",
            "Coming to Office",
            () => {
                showAlert(
                    "Office Payment",
                    "Please visit our office in Bakau, near the Stadium, Gambia. Call 388 8888 for directions if needed."
                );
            }
        );
    };

    const requestAccountDeletion = async () => {
        if (!user) return { success: false, error: 'User not authenticated' };

        try {
            const { data, error } = await supabase.rpc('delete_partner_account');

            if (error) {
                console.error('Error requesting account deletion:', error);
                return { success: false, error: error.message };
            }

            if (data?.startsWith('DEBT_BLOCK:')) {
                const debtAmount = data.split(':')[1];
                return { success: false, error: 'DEBT_BLOCK', debtAmount };
            }

            if (data === 'SUCCESS') {
                return { success: true };
            }

            return { success: false, error: data || 'Unknown error occurred' };
        } catch (err: any) {
            console.error('Exception during account deletion:', err);
            return { success: false, error: err.message || 'An unexpected error occurred' };
        }
    };

    const submitManualPayment = async (method: 'WAVE_MANUAL' | 'OFFICE', transactionId?: string, amount?: number) => {
        if (!user) return { success: false, error: 'User not authenticated' };
        
        const paymentAmount = amount !== undefined ? amount : profile.commissionDebt;

        try {
            // Check for 5-minute cooldown for the same transaction ID or recent submission
            const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            
            const { data: recentPayments, error: checkError } = await supabase
                .from('manual_payments')
                .select('created_at')
                .eq('user_id', user.id)
                .gte('created_at', fiveMinsAgo)
                .order('created_at', { ascending: false })
                .limit(1);

            if (checkError) console.error("Cooldown check error:", checkError);
            
            if (recentPayments && recentPayments.length > 0) {
                const lastSub = new Date(recentPayments[0].created_at);
                const nextAllowed = new Date(lastSub.getTime() + 5 * 60 * 1000);
                const waitSecs = Math.ceil((nextAllowed.getTime() - Date.now()) / 1000);
                return { 
                    success: false, 
                    error: `Please wait ${Math.floor(waitSecs / 60)}m ${waitSecs % 60}s before submitting another payment.` 
                };
            }

            const { error } = await supabase.from('manual_payments').insert({
                user_id: user.id,
                amount: paymentAmount,
                transaction_id: transactionId,
                payment_method: method,
                status: 'PENDING'
            });

            if (error) throw error;

            setPendingManualPayment({
                amount: paymentAmount,
                method,
                createdAt: new Date().toISOString()
            });

            return { success: true };
        } catch (err: any) {
            console.error("Manual Payment Error:", err);
            return { success: false, error: err.message };
        }
    };

    const signOut = async () => {
        setIncomingRides([]);
        setIsOnboarded(false); // Force redirect to onboarding/login
        try {
            await supabase.auth.signOut();
            window.location.reload(); // Hard reload for clean state
        } catch (error) {
            console.warn('Sign out failed, likely due to session already being invalidated (e.g. account deleted):', error);
            window.location.reload(); // Still reload even if error
        }
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
            requestAccountDeletion, submitManualPayment, pendingManualPayment,
            rideStats, orderStats, incomingRides, setIncomingRides,
            rejectedRideIds, setRejectedRideIds: addToRejectedRides,
            appSettings,
            isLocked: (profile.commissionDebt >= appSettings.max_driver_cash_amount) || profile.isSuspended,
            lockReason: profile.isSuspended ? 'SUSPENDED' : (profile.commissionDebt >= appSettings.max_driver_cash_amount ? 'DEBT_LIMIT' : null),
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
