import React, { useState } from 'react';
import { Clock, CheckCircle, Package, MessageSquare, X, Check, Trash2, Truck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ActionButton } from '../components/ActionButton';
import { Order, OrderStatus } from '../types';

const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
    const styles = {
        pending: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
        accepted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        preparing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        delivering: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
        arrived: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };

    const style = styles[status] || 'bg-gray-100 text-gray-800';

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${style}`} >
            {status}
        </span >
    );
};

export const MerchantOrders: React.FC = () => {
    const { merchantOrders, updateOrderStatus, openChat, pushNotification, createDeliveryRequest, deleteOrder } = useApp();
    const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        setIsProcessing(orderId);
        try {
            const success = await updateOrderStatus(orderId, newStatus);
            if (success) {
                pushNotification('Order Updated', `Order #${orderId.slice(0, 8)} marked as ${newStatus}`, 'ORDER');

                // Update selected order in modal if open
                if (selectedOrder && selectedOrder.id === orderId) {
                    const updated = merchantOrders.find(o => o.id === orderId);
                    if (updated) setSelectedOrder({ ...updated, status: newStatus });
                }

                if (newStatus === 'ready') {
                    const deliverySuccess = await createDeliveryRequest(orderId);
                    if (deliverySuccess) {
                        pushNotification('Delivery Search', 'Searching for nearby drivers...', 'SYSTEM');
                    }
                }
            }
        } finally {
            setIsProcessing(null);
        }
    };

    const handleRejectOrder = async (orderId: string) => {
        if (window.confirm('Are you sure you want to reject this order?')) {
            setIsProcessing(orderId);
            try {
                const success = await updateOrderStatus(orderId, 'cancelled');
                if (success) {
                    pushNotification('Order Rejected', `Order #${orderId.slice(0, 8)} has been cancelled`, 'ORDER');
                    if (selectedOrder?.id === orderId) setSelectedOrder(null);
                }
            } finally {
                setIsProcessing(null);
            }
        }
    };

    const filteredOrders = filter === 'ALL' ? merchantOrders : merchantOrders.filter(o => o.status === filter);

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black">
            {/* Fixed Header */}
            <div className="px-6 pt-14 pb-4 shrink-0 bg-gray-50 dark:bg-black z-10">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Orders</h1>

                {/* Filter Pills */}
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {['ALL', 'pending', 'accepted', 'preparing', 'ready', 'arrived', 'delivering', 'completed', 'cancelled'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setFilter(s as any)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${filter === s
                                ? 'bg-black dark:bg-white text-white dark:text-black'
                                : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'
                                }`}
                        >
                            {s === 'ALL' ? 'All Orders' : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-32 pt-2 space-y-4 no-scrollbar">
                {filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Package size={48} className="mb-2 opacity-50" />
                        <p>No orders found</p>
                    </div>
                ) : (
                    filteredOrders.map(order => (
                        <div
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className="bg-white dark:bg-zinc-900 rounded-[28px] shadow-sm border border-gray-100 dark:border-zinc-800 p-5 transition-all active:scale-[0.98] cursor-pointer hover:border-[#00E39A]/30 relative overflow-hidden"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-black overflow-hidden border border-slate-100 dark:border-zinc-800">
                                        {order.items[0]?.product.image ? (
                                            <img src={order.items[0].product.image} className="w-full h-full object-cover" alt="Product" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Package size={20} />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-[17px] font-black text-gray-900 dark:text-white leading-tight">{order.customerName}</h3>
                                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">#{order.id.slice(0, 8)} • {order.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <StatusBadge status={order.status} />
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-gray-400">Total</span>
                                    <span className="text-xl font-black text-[#00E39A]">D{order.total}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Apple-style Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSelectedOrder(null)} />
                    <div className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-t-[42px] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-500">
                        {/* Pull Bar (Mobile) */}
                        <div className="w-12 h-1 bg-gray-200 dark:bg-zinc-800 rounded-full mx-auto mt-3 sm:hidden" />

                        <div className="p-6 max-h-[85vh] overflow-y-auto no-scrollbar">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-zinc-900 overflow-hidden border border-gray-100 dark:border-zinc-800">
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedOrder.customerName}`} className="w-full h-full object-cover" alt="Customer" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{selectedOrder.customerName}</h2>
                                        <p className="text-sm text-gray-500 font-bold">Order #{selectedOrder.id.slice(0, 8)}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-full bg-gray-100 dark:bg-zinc-900 text-gray-500">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-2xl p-4 border border-gray-100 dark:border-zinc-900">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Status</p>
                                    <StatusBadge status={selectedOrder.status} />
                                </div>

                                <div className="space-y-4">
                                    {selectedOrder.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-[24px] border border-slate-50 dark:border-zinc-800">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-black overflow-hidden border border-slate-100 dark:border-zinc-800 shadow-sm shrink-0">
                                                    {item.product.image ? (
                                                        <img src={item.product.image} className="w-full h-full object-cover" alt={item.product.name} />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                            <Package size={24} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-[17px] font-black text-gray-900 dark:text-white leading-tight">{item.quantity}x {item.product.name}</p>
                                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">D{item.product.price} each</p>
                                                </div>
                                            </div>
                                            <p className="text-[17px] font-black text-gray-900 dark:text-white">D{item.product.price * item.quantity}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-4 border-t border-gray-100 dark:border-zinc-900 flex justify-between items-center">
                                    <p className="text-lg font-black text-gray-900 dark:text-white">Total</p>
                                    <p className="text-2xl font-black text-[#00E39A]">D{selectedOrder.total}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <a href={`tel:${selectedOrder.customerPhone}`} className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a2 2 0 011.9.1.91 2.5 0 011.0.8l1.45 2.5a2 2 0 01-.4 2.1l-2.0 1.25a2 2 0 00-.8 2.2c.4 1.1 1.2 2 2.2 2.4a2 2 0 002.2-.8l1.25-2.0a2 2 0 012.1-.4l2.5 1.45a1.9 1.9 0 01.8 1.0c.3.7.2 1.5-.1 1.9a2 2 0 01-1.9.1l-2.28-.1a2 2 0 01-2-2C11 18 3 10 3 5z" /></svg>
                                    Call
                                </a>
                                <a href={`https://wa.me/${selectedOrder.customerPhone?.replace(/\D/g, '')}`} target="_blank" className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-bold">
                                    <MessageSquare size={20} />
                                    WhatsApp
                                </a>
                            </div>

                            {/* Actions Block */}
                            <div className="space-y-3">
                                {selectedOrder.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            disabled={isProcessing === selectedOrder.id}
                                            onClick={() => handleStatusChange(selectedOrder.id, 'accepted')}
                                            className={`flex-1 h-16 bg-[#00E39A] text-black font-black rounded-2xl text-lg shadow-lg flex items-center justify-center ${isProcessing === selectedOrder.id ? 'opacity-70' : ''}`}
                                        >
                                            {isProcessing === selectedOrder.id ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                                    Processing...
                                                </div>
                                            ) : 'Accept Order'}
                                        </button>
                                    </div>
                                )}
                                {selectedOrder.status === 'accepted' && (
                                    <button
                                        disabled={isProcessing === selectedOrder.id}
                                        onClick={() => handleStatusChange(selectedOrder.id, 'preparing')}
                                        className={`w-full h-16 bg-black dark:bg-white text-white dark:text-black font-black rounded-2xl text-lg shadow-lg flex items-center justify-center ${isProcessing === selectedOrder.id ? 'opacity-70' : ''}`}
                                    >
                                        {isProcessing === selectedOrder.id ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                                                Processing...
                                            </div>
                                        ) : 'Start Preparing'}
                                    </button>
                                )}
                                {selectedOrder.status === 'preparing' && (
                                    <button
                                        disabled={isProcessing === selectedOrder.id}
                                        onClick={() => handleStatusChange(selectedOrder.id, 'ready')}
                                        className={`w-full h-16 bg-[#00E39A] text-black font-black rounded-2xl text-lg shadow-lg flex items-center justify-center ${isProcessing === selectedOrder.id ? 'opacity-70' : ''}`}
                                    >
                                        {isProcessing === selectedOrder.id ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                                Processing...
                                            </div>
                                        ) : 'Mark as Ready'}
                                    </button>
                                )}
                                {selectedOrder.status === 'ready' && (
                                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-800/30 flex items-center gap-3">
                                        <Clock className="animate-pulse text-orange-500" size={20} />
                                        <p className="text-orange-600 dark:text-orange-400 text-sm font-bold">Searching for a driver...</p>
                                    </div>
                                )}
                                {selectedOrder.status === 'arrived' && (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30 flex items-center gap-3">
                                        <Truck className="animate-pulse text-blue-500" size={20} />
                                        <p className="text-blue-600 dark:text-blue-400 text-sm font-bold">Driver has arrived for pickup!</p>
                                    </div>
                                )}
                                {selectedOrder.status === 'delivering' && (
                                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 flex items-center gap-3">
                                        <Truck className="animate-pulse text-indigo-500" size={20} />
                                        <p className="text-indigo-600 dark:text-indigo-400 text-sm font-bold">Driver is assigned and on the way!</p>
                                    </div>
                                )}
                                {['delivering', 'arrived', 'ready', 'preparing', 'accepted'].includes(selectedOrder.status) && (
                                    <button
                                        disabled={isProcessing === selectedOrder.id}
                                        onClick={() => handleStatusChange(selectedOrder.id, 'completed')}
                                        className={`w-full h-16 bg-green-600 dark:bg-green-500 text-white font-black rounded-2xl text-lg shadow-lg mt-2 flex items-center justify-center ${isProcessing === selectedOrder.id ? 'opacity-70' : ''}`}
                                    >
                                        {isProcessing === selectedOrder.id ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                Syncing...
                                            </div>
                                        ) : 'Force Complete Order'}
                                    </button>
                                )}
                                {['pending', 'accepted', 'preparing', 'ready', 'arrived'].includes(selectedOrder.status) && (
                                    <button
                                        disabled={isProcessing === selectedOrder.id}
                                        onClick={() => handleRejectOrder(selectedOrder.id)}
                                        className={`w-full h-16 bg-red-50 dark:bg-red-900/10 text-red-500 font-bold rounded-2xl border border-red-100 dark:border-red-900/30 mt-2 flex items-center justify-center ${isProcessing === selectedOrder.id ? 'opacity-70' : ''}`}
                                    >
                                        {isProcessing === selectedOrder.id ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 border-2 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                                                Cancelling...
                                            </div>
                                        ) : 'Reject Order'}
                                    </button>
                                )}
                                {['completed', 'cancelled'].includes(selectedOrder.status) && (
                                    <button
                                        disabled={isProcessing === selectedOrder.id}
                                        onClick={async () => {
                                            if (window.confirm('Remove this order from your view? (It will be hidden but remain in our records)')) {
                                                setIsProcessing(selectedOrder.id);
                                                try {
                                                    await deleteOrder(selectedOrder.id);
                                                    setSelectedOrder(null);
                                                } finally {
                                                    setIsProcessing(null);
                                                }
                                            }
                                        }}
                                        className={`w-full h-16 bg-red-50 dark:bg-red-900/10 text-red-500 font-bold rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center justify-center ${isProcessing === selectedOrder.id ? 'opacity-70' : ''}`}
                                    >
                                        {isProcessing === selectedOrder.id ? 'Removing...' : 'Remove from View'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};