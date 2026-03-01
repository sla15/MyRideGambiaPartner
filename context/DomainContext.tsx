import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Order, Product, Transaction, Review, RideRequest, RideStatus, OrderStatus } from '../types';
import { DUMMY_ORDERS, TRANSACTIONS, REVIEWS } from '../data/dummyData';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface DomainContextType {
    orders: Order[];
    setOrders: (orders: Order[]) => void;
    products: Product[];
    loadProducts: (businessId: string) => Promise<void>;
    addProduct: (product: Omit<Product, 'id'>, businessId: string) => Promise<boolean>;
    updateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
    deleteProduct: (id: string) => Promise<boolean>;
    deleteOrder: (id: string) => Promise<boolean>;
    deleteRide: (id: string) => Promise<boolean>;
    transactions: Transaction[];
    reviews: Review[];
    merchantOrders: Order[];
    loadMerchantOrders: (businessId: string) => Promise<void>;
    updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<boolean>;
    createDeliveryRequest: (orderId: string) => Promise<boolean>;
    currentRide: RideRequest | null;
    setCurrentRide: (ride: RideRequest | null) => void;
    rideStatus: RideStatus;
    setRideStatus: (status: RideStatus) => void;
}

const DomainContext = createContext<DomainContextType | undefined>(undefined);

export const DomainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [merchantOrders, setMerchantOrders] = useState<Order[]>([]);
    const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
    const [rideStatus, setRideStatus] = useState<RideStatus>('IDLE');

    const loadProducts = useCallback(async (businessId: string) => {
        try {
            const { data, error } = await supabase.from('products').select('*').eq('business_id', businessId);
            if (error) throw error;

            const mappedProducts: Product[] = (data || []).map(p => ({
                id: p.id,
                name: p.name || 'Unknown Product',
                description: p.description || '',
                price: parseFloat(p.price || '0'),
                image: p.image_url || '',
                category: p.category || '',
                stock: p.stock || 0,
                isAvailable: p.is_available ?? true
            }));
            setProducts(mappedProducts);
        } catch (err) {
            console.error("Error loading products:", err);
        }
    }, []);

    const loadMerchantOrders = useCallback(async (businessId: string) => {
        try {
            // Use explicit Foreign Key for customer join to avoid ambiguity (customer_id vs driver_id)
            const { data: ordersData, error } = await supabase
                .from('orders')
                .select('*, customer:profiles!orders_customer_id_fkey(full_name, phone)')
                .eq('business_id', businessId)
                .eq('hidden_by_merchant', false)
                .order('created_at', { ascending: false });

            console.log(`[DomainContext] Loaded ${ordersData?.length} orders for business ${businessId}`);
            if (error) {
                console.error("[DomainContext] Error fetching orders (Check console for object details):", JSON.stringify(error, null, 2));
                throw error;
            }

            if (error) throw error;

            const ordersWithItems: Order[] = [];
            for (const o of ordersData) {
                const { data: items } = await supabase
                    .from('order_items')
                    .select('*, products(*)')
                    .eq('order_id', o.id);

                const customerData = Array.isArray(o.customer) ? o.customer[0] : o.customer;

                // Safety check for items with missing products
                const validItems = (items || []).filter(i => i.products);

                ordersWithItems.push({
                    id: o.id,
                    customerName: customerData?.full_name || 'Customer',
                    customerPhone: customerData?.phone || '',
                    status: o.status as OrderStatus,
                    total: parseFloat(o.total_amount),
                    timestamp: new Date(o.created_at),
                    items: (validItems || []).map(i => {
                        // Ensure product data is an object even if Supabase returns it as a list
                        const productData = Array.isArray(i.products) ? i.products[0] : i.products;

                        return {
                            product: {
                                id: productData?.id,
                                name: productData?.name || 'Unknown Product',
                                price: parseFloat(productData?.price || '0'),
                                image: productData?.image_url || '',
                                category: productData?.category || ''
                            } as any,
                            quantity: i.quantity || 1,
                            checked: false
                        };
                    })
                });
            }
            setMerchantOrders(ordersWithItems);
            console.log(`[DomainContext] Final processed orders: ${ordersWithItems.length}`, ordersWithItems);
        } catch (err) {
            console.error("Error loading merchant orders:", err);
        }
    }, []);

    const loadData = useCallback(async () => {
        if (!user) return;

        try {
            // 1. Fetch Completed Rides
            const { data: rides } = await supabase.from('rides')
                .select('*')
                .eq('driver_id', user.id)
                .eq('status', 'completed')
                .order('created_at', { ascending: false });

            // 2. Fetch Completed Orders (if merchant)
            let merchantOrders: any[] = [];
            const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user.id).maybeSingle();
            if (business) {
                const { data: ordersData } = await supabase.from('orders')
                    .select('*')
                    .eq('business_id', business.id)
                    .eq('status', 'completed')
                    .eq('hidden_by_merchant', false)
                    .order('created_at', { ascending: false });
                merchantOrders = ordersData || [];
            }

            // 3. Map to Transactions
            const rideTx: Transaction[] = (rides || []).map(r => ({
                id: r.id,
                type: 'RIDE',
                amount: parseFloat(r.price || '0'),
                date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A',
                description: `Ride to ${r.dropoff_address?.split(',')[0] || 'Unknown'}`,
                status: 'completed',
                commission: parseFloat(r.price || '0') * 0.2
            }));

            const orderTx: Transaction[] = (merchantOrders || []).map(o => ({
                id: o.id,
                type: 'ORDER',
                amount: parseFloat(o.total_amount || '0'),
                date: o.created_at ? new Date(o.created_at).toLocaleDateString() : 'N/A',
                description: `Order #${o.id?.slice(0, 8) || '...'}`,
                status: 'completed',
                commission: parseFloat(o.total_amount || '0') * 0.15
            }));

            setTransactions([...rideTx, ...orderTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

            // 4. Fetch Reviews
            const { data: reviewsData } = await supabase.from('reviews')
                .select('*')
                .eq('target_id', user.id)
                .order('created_at', { ascending: false });

            // Fetch reviewer names manually (simpler than complex join for now without type gen)
            const mappedReviews: Review[] = [];
            if (reviewsData) {
                for (const r of reviewsData) {
                    try {
                        const { data: reviewer } = await supabase.from('profiles').select('full_name').eq('id', r.reviewer_id).single();
                        mappedReviews.push({
                            id: r.id,
                            reviewerName: reviewer?.full_name || 'Anonymous',
                            rating: r.rating || 0,
                            comment: r.comment || '',
                            date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'
                        });
                    } catch (reviewErr) {
                        console.error("Error mapping individual review:", reviewErr);
                    }
                }
            }
            setReviews(mappedReviews);

            if (business) {
                await loadMerchantOrders(business.id);
            }
        } catch (err) {
            console.error("Error loading domain data:", err);
        }
    }, [user, loadMerchantOrders]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // REAL-TIME SUBSCRIPTIONS
    useEffect(() => {
        if (!user) return;

        let ordersChannel: any;
        let productsChannel: any;
        let categoriesChannel: any;

        const setupSubscriptions = async () => {
            const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user.id).maybeSingle();

            // 1. Order Subscription (for this business)
            if (business) {
                ordersChannel = supabase
                    .channel(`merchant_orders_${business.id}`)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'orders',
                        filter: `business_id=eq.${business.id}`
                    }, () => {
                        try {
                            loadMerchantOrders(business.id);
                        } catch (err) {
                            console.error("[Realtime] Error loading orders:", err);
                        }
                    })
                    .subscribe();

                // 2. Products Subscription (for this business)
                productsChannel = supabase
                    .channel(`merchant_products_${business.id}`)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'products',
                        filter: `business_id=eq.${business.id}`
                    }, () => {
                        try {
                            loadProducts(business.id);
                        } catch (err) {
                            console.error("[Realtime] Error loading products:", err);
                        }
                    })
                    .subscribe();
            }

            // 3. Global Business Categories Subscription
            categoriesChannel = supabase
                .channel('public:business_categories')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'business_categories'
                }, () => loadData()) // loadData refreshes everything including transactions/categories
                .subscribe();
        };

        setupSubscriptions();

        return () => {
            if (ordersChannel) supabase.removeChannel(ordersChannel);
            if (productsChannel) supabase.removeChannel(productsChannel);
            if (categoriesChannel) supabase.removeChannel(categoriesChannel);
        };
    }, [user, loadMerchantOrders, loadProducts, loadData]);


    const createDeliveryRequest = async (orderId: string) => {
        try {
            // 1. Fetch Order and its Batch info
            const { data: order, error: orderErr } = await supabase
                .from('orders')
                .select('*, businesses(*)')
                .eq('id', orderId)
                .single();

            if (orderErr || !order) throw new Error("Order not found");

            let batchId = order.batch_id;

            // If no batch_id exists, create one and update the order
            if (!batchId) {
                batchId = crypto.randomUUID();
                await supabase.from('orders').update({ batch_id: batchId }).eq('id', orderId);
            }

            // 2. Fetch all orders in this batch (or just this order if no batch)
            let batchOrders = [order];
            if (batchId) {
                const { data } = await supabase
                    .from('orders')
                    .select('*, businesses(*)')
                    .eq('batch_id', batchId)
                    .neq('status', 'cancelled');
                if (data) batchOrders = data;
            }

            // 3. Calculate Total Cash Upfront (sum of order item totals) - Round up to next figure
            const totalCashUpfront = Math.ceil(batchOrders?.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0) || parseFloat(order.total_amount));

            // 4. Collect all pickup stops with names and addresses
            const merchants = batchOrders?.map(o => ({
                id: o.business_id,
                name: o.businesses?.name || 'Shop',
                address: o.businesses?.location_address || '',
                amount: parseFloat(o.total_amount || '0'),
                phone: o.businesses?.business_phone || ''
            })) || [];

            const stops = merchants.map(m => JSON.stringify({
                business_id: m.id,
                business_name: m.name,
                business_address: m.address,
                business_phone: m.phone,
                estimated_cash: m.amount
            }));

            // 5. Fetch Settings for Fee
            const { data: settings } = await supabase.from('app_settings').select('*').limit(1).single();

            const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                const R = 6371;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            };

            const business = order.businesses;
            const distance = calculateDistance(
                business.lat, business.lng,
                order.dropoff_lat || business.lat, order.dropoff_lng || business.lng
            );

            const minFee = parseFloat(settings?.min_delivery_fee || '100');
            const ratePerKm = parseFloat(settings?.price_per_km || '12');
            const multiplier = parseFloat(settings?.multiplier_scooter || '0.7');

            // Base price based on distance
            const basePrice = Math.max(minFee, Math.round(distance * ratePerKm * multiplier));

            // Multi-stop surcharge: D10 for every additional stop beyond the first
            const pricePerStop = parseFloat(settings?.price_per_stop || '10');
            const distinctBusinesses = new Set(merchants.map(m => m.name));
            const stopSurcharge = Math.max(0, (distinctBusinesses.size - 1) * pricePerStop);
            const finalPrice = Math.ceil(basePrice + stopSurcharge);

            // 6. Check if a ride already exists for this batch
            const { data: existingRide } = await supabase
                .from('rides')
                .select('*')
                .eq(batchId ? 'batch_id' : 'id', batchId || 'none') // Safety check
                .neq('status', 'completed')
                .neq('status', 'cancelled')
                .maybeSingle();

            // Special case for single orders if no batch_id: 
            // We search by custom logic or just create new if no batch exists to group by.
            // But usually we always want a batch_id for merchant deliveries to group them.

            if (existingRide) {
                // Update existing ride with new stops, cash total, and updated price
                const { error: updateErr } = await supabase.from('rides').update({
                    stops,
                    total_cash_upfront: totalCashUpfront,
                    price: finalPrice,
                    type: 'MERCHANT_DELIVERY',
                    ride_type: 'MERCHANT_DELIVERY'
                }).eq('id', existingRide.id);

                if (updateErr) throw updateErr;

                // 6b. If ride is already accepted, notify the driver
                if (existingRide.driver_id && ['accepted', 'arrived', 'in-progress'].includes(existingRide.status)) {
                    await supabase.functions.invoke('send-fcm-notification', {
                        body: {
                            userIds: [existingRide.driver_id],
                            title: "New Delivery Added!",
                            message: `Another shop in your batch is ready. Total cash needed: D${totalCashUpfront}`,
                            data: { type: 'batch_update', ride_id: existingRide.id }
                        }
                    });
                }
                return true;
            }

            // 7. If no existing ride, create a new one
            const { error: rideErr } = await supabase.from('rides').insert({
                customer_id: order.customer_id,
                batch_id: batchId,
                pickup_lat: business.lat,
                pickup_lng: business.lng,
                pickup_address: business.location_address,
                dropoff_lat: order.dropoff_lat || business.lat,
                dropoff_lng: order.dropoff_lng || business.lng,
                dropoff_address: order.delivery_address || 'Customer Location',
                price: finalPrice,
                status: 'searching',
                type: 'MERCHANT_DELIVERY',
                requested_vehicle_type: 'scooter',
                ride_type: 'MERCHANT_DELIVERY',
                stops: stops,
                total_cash_upfront: totalCashUpfront,
                current_stop_index: 0
            });

            if (rideErr) throw rideErr;
            return true;
        } catch (err) {
            console.error("Error creating delivery request:", err);
            return false;
        }
    };

    const addProduct = async (product: Omit<Product, 'id'>, businessId: string) => {
        try {
            const { error } = await supabase.from('products').insert({
                business_id: businessId,
                name: product.name,
                description: product.description,
                price: product.price,
                image_url: product.image,
                category: product.category,
                stock: product.stock,
                is_available: product.isAvailable
            });
            if (error) throw error;
            await loadProducts(businessId);
            return true;
        } catch (err) {
            console.error("Error adding product:", err);
            return false;
        }
    };

    const updateProduct = async (id: string, updates: Partial<Product>) => {
        try {
            const payload: any = {};
            if (updates.name !== undefined) payload.name = updates.name;
            if (updates.description !== undefined) payload.description = updates.description;
            if (updates.price !== undefined) payload.price = updates.price;
            if (updates.image !== undefined) payload.image_url = updates.image;
            if (updates.category !== undefined) payload.category = updates.category;
            if (updates.stock !== undefined) payload.stock = updates.stock;
            if (updates.isAvailable !== undefined) payload.is_available = updates.isAvailable;

            const { error } = await supabase.from('products').update(payload).eq('id', id);
            if (error) throw error;

            // Re-load for the specific business (need to find business_id first or just reload global products)
            // For now, let's just refresh if we have a user/business context
            const { data } = await supabase.from('products').select('business_id').eq('id', id).single();
            if (data) await loadProducts(data.business_id);

            return true;
        } catch (err) {
            console.error("Error updating product:", err);
            return false;
        }
    };

    const deleteProduct = async (id: string) => {
        try {
            const { data } = await supabase.from('products').select('business_id').eq('id', id).single();
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            if (data) await loadProducts(data.business_id);
            return true;
        } catch (err) {
            console.error("Error deleting product:", err);
            return false;
        }
    };

    const deleteOrder = async (orderId: string) => {
        try {
            console.log("Attempting to hide order from merchant:", orderId);
            const { data } = await supabase.from('orders').select('business_id').eq('id', orderId).single();

            // Soft delete: just mark as hidden for merchant
            const { error } = await supabase
                .from('orders')
                .update({ hidden_by_merchant: true })
                .eq('id', orderId);

            if (error) throw error;

            console.log("Order hidden successfully from merchant");
            if (data?.business_id) await loadMerchantOrders(data.business_id);
            return true;
        } catch (err) {
            console.error("Error hiding order:", err);
            return false;
        }
    };

    const deleteRide = async (rideId: string) => {
        try {
            const { error } = await supabase.from('rides').delete().eq('id', rideId);
            if (error) throw error;
            await loadData(); // Reload transactions and history
            return true;
        } catch (err) {
            console.error("Error deleting ride:", err);
            return false;
        }
    };

    const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status })
                .eq('id', orderId);

            if (error) throw error;

            // 1. If status is 'accepted', decrement stock
            if (status === 'accepted') {
                const { data: orderItems } = await supabase.from('order_items').select('product_id, quantity').eq('order_id', orderId);
                if (orderItems) {
                    for (const item of orderItems) {
                        // RPC or raw update. Use raw for simplicity as we have products access.
                        // Ideally strictly atomic but this is acceptable for now.
                        const { data: rpcData } = await supabase.rpc('decrement_stock', { p_id: item.product_id, qty: item.quantity });
                        // If RPC doesn't exist, we do manual:
                        /* 
                        const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
                        if (prod) {
                             await supabase.from('products').update({ stock: Math.max(0, prod.stock - item.quantity) }).eq('id', item.product_id);
                        }
                        */
                        // Let's stick to manual update for safety if RPC isn't confirmed created.
                        const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
                        if (prod) {
                            await supabase.from('products').update({ stock: Math.max(0, prod.stock - item.quantity) }).eq('id', item.product_id);
                        }
                    }
                }
            }

            // 2. If status is 'ready', automatically create a delivery request
            if (status === 'ready') {
                await createDeliveryRequest(orderId);
            }

            // 3. If status is 'cancelled', hide from merchant and check batch
            if (status === 'cancelled') {
                await supabase.from('orders').update({ hidden_by_merchant: true }).eq('id', orderId);

                const { data: orderData } = await supabase.from('orders').select('batch_id, customer_id').eq('id', orderId).single();
                if (orderData?.batch_id) {
                    const { data: otherOrders } = await supabase
                        .from('orders')
                        .select('id')
                        .eq('batch_id', orderData.batch_id)
                        .in('status', ['accepted', 'preparing', 'ready', 'delivering'])
                        .neq('id', orderId);

                    if (!otherOrders || otherOrders.length === 0) {
                        // All orders in batch are cancelled/completed, cancel the ride if it's still searching or accepted
                        const { data: ride } = await supabase
                            .from('rides')
                            .select('id')
                            .eq('batch_id', orderData.batch_id)
                            .neq('status', 'completed')
                            .neq('status', 'cancelled')
                            .maybeSingle();

                        if (ride) {
                            await supabase.from('rides').update({ status: 'cancelled' }).eq('id', ride.id);
                        }
                    }
                } else if (orderData) {
                    // Single order: find the ride associated with this customer that is still searching and cancel it
                    const { data: ride } = await supabase
                        .from('rides')
                        .select('id')
                        .eq('customer_id', orderData.customer_id)
                        .eq('status', 'searching')
                        .is('batch_id', null)
                        .maybeSingle();

                    if (ride) {
                        await supabase.from('rides').update({ status: 'cancelled' }).eq('id', ride.id);
                    }
                }
            }

            // Reload for consistency
            const { data } = await supabase.from('orders').select('business_id').eq('id', orderId).single();
            if (data) await loadMerchantOrders(data.business_id);

            return true;
        } catch (err) {
            console.error("Error updating order status:", err);
            return false;
        }
    };

    return (
        <DomainContext.Provider value={{
            orders, setOrders, products, loadProducts, addProduct, updateProduct, deleteProduct, deleteOrder, deleteRide,
            transactions, reviews, merchantOrders, loadMerchantOrders, updateOrderStatus,
            createDeliveryRequest, currentRide, setCurrentRide, rideStatus, setRideStatus
        }}>
            {children}
        </DomainContext.Provider>
    );
};

export const useDomain = () => {
    const context = useContext(DomainContext);
    if (context === undefined) throw new Error('useDomain must be used within a DomainProvider');
    return context;
};
