
import React from 'react';
import { Star, Navigation, MessageSquare, X, Wallet, CheckCircle, MapPin, EyeOff, Play, Check, Phone, MessageCircle } from 'lucide-react';
import { RideRequest, RideStatus } from '../types';
import { SlideButton } from './SlideButton';

interface RideDrawerProps {
    currentRide: RideRequest;
    rideStatus: RideStatus;
    isDrawerExpanded: boolean;
    toggleDrawer: () => void;
    onAccept: () => void;
    onDecline: () => void;
    onCancel: () => void;
    onArrived: () => void;
    onStartRide: () => void;
    onComplete: () => void;
    onChat: () => void;
    onCollectPayment: () => void;
    onNextStop?: () => void;
    countdown: number;
    rideType?: 'PASSENGER' | 'DELIVERY' | 'MERCHANT_DELIVERY';
    queueCount?: number;
    currentLat?: number;
    currentLng?: number;
    isProcessing?: boolean;
    onClose?: () => void;
}

export const RideDrawer: React.FC<RideDrawerProps> = ({
    currentRide,
    rideStatus,
    isDrawerExpanded,
    toggleDrawer,
    onAccept,
    onDecline,
    onCancel,
    onArrived,
    onStartRide,
    onComplete,
    onChat,
    onCollectPayment,
    onNextStop,
    countdown,
    rideType = 'PASSENGER',
    queueCount = 1,
    currentLat,
    currentLng,
    isProcessing = false,
    onClose
}) => {
    const [showCashConfirm, setShowCashConfirm] = React.useState(false);

    const isNavigating = rideStatus === 'NAVIGATING';
    const isRideStarted = rideStatus === 'NAVIGATING' || rideStatus === 'COMPLETED';
    const isRideActive = rideStatus !== 'IDLE' && rideStatus !== 'RINGING';

    // Dynamic height — compact so the map stays visible
    const drawerHeight = isDrawerExpanded
        ? 'h-[88vh]'
        : rideStatus === 'RINGING'
            ? 'h-[340px]'
            : (rideStatus === 'NAVIGATING')
                ? 'h-[230px]'
                : (rideStatus === 'ARRIVED')
                    ? 'h-[270px]'
                    : 'h-[280px]'; // ACCEPTED

    return (
        <div
            className={`absolute bottom-0 left-0 right-0 z-40 px-0 sm:px-4 pb-0 sm:pb-4 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${drawerHeight}`}
        >
            {/* Background stack effect if multiple items exist */}
            {rideStatus === 'RINGING' && queueCount > 1 && (
                <>
                    <div className="absolute top-2 left-4 right-4 h-full bg-white/40 dark:bg-white/5 rounded-t-[2.5rem] -translate-y-4 scale-[0.9] blur-[2px] z-0"></div>
                    <div className="absolute top-2 left-8 right-8 h-full bg-white/20 dark:bg-white/5 rounded-t-[2.5rem] -translate-y-2 scale-[0.95] blur-[1px] z-0"></div>
                </>
            )}
            {/* Incoming Request Label */}
            {rideStatus === 'RINGING' && !isDrawerExpanded && (
                <div className="flex justify-center mb-4 transition-opacity duration-300">
                    <div className="bg-black/80 backdrop-blur-md px-6 py-3 rounded-full border border-[#00E39A]/30 flex items-center gap-2 shadow-lg">
                        <div className="w-2 h-2 rounded-full bg-[#00E39A] animate-pulse"></div>
                        <span className="text-white font-bold text-sm tracking-wide">
                            {queueCount > 1 ? `${queueCount} NEW REQUESTS` : `INCOMING ${rideType === 'DELIVERY' || rideType === 'MERCHANT_DELIVERY' ? 'DELIVERY' : 'RIDE'}`}
                        </span>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-[#1C1C1E] rounded-t-[2.5rem] sm:rounded-b-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] border-t border-gray-100 dark:border-gray-800 h-full flex flex-col relative overflow-hidden transition-colors duration-300">

                {/* Drag Handle */}
                <div
                    onClick={toggleDrawer}
                    className="w-full p-4 flex justify-center cursor-pointer active:opacity-70 transition-opacity z-20 shrink-0"
                >
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700/50 rounded-full"></div>
                </div>

                <div className={`flex-1 overflow-y-auto no-scrollbar px-4 pb-4 ${isDrawerExpanded ? 'overflow-y-auto' : 'overflow-hidden'}`}>

                    {/* Header: User & Price */}
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden border-2 border-white dark:border-gray-600 flex items-center justify-center">
                                    {currentRide.passengerImage ? (
                                        <img
                                            src={rideStatus === 'RINGING'
                                                ? `https://api.dicebear.com/7.x/shapes/svg?seed=masked`
                                                : currentRide.passengerImage}
                                            alt="User"
                                            className={`w-full h-full object-cover ${rideStatus === 'RINGING' ? 'opacity-40 grayscale animate-pulse' : ''}`}
                                        />
                                    ) : (
                                        <div className={`w-full h-full flex items-center justify-center bg-[#00E39A] text-black font-bold text-xl ${rideStatus === 'RINGING' ? 'opacity-40 grayscale animate-pulse' : ''}`}>
                                            {currentRide.passengerName?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#2C2C2E] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <Star size={10} className="text-yellow-500 fill-current" />
                                    <span className="text-gray-900 dark:text-white text-[10px] font-bold">{currentRide.passengerRating || currentRide.rating}</span>
                                </div>
                            </div>
                            <div>
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                                        {rideStatus === 'RINGING'
                                            ? (rideType === 'MERCHANT_DELIVERY' ? 'Merchant Delivery' : 'New Passenger')
                                            : currentRide.passengerName}
                                    </h3>
                                    {isRideActive && (
                                        <div className="flex gap-2 mt-1">
                                            {rideStatus === 'ACCEPTED' && (
                                                <span className="text-blue-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Driving to Pickup</span>
                                            )}
                                            {rideStatus === 'ARRIVED' && (
                                                <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">At Pickup • Waiting</span>
                                            )}
                                            {rideStatus === 'NAVIGATING' && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[#00E39A] text-[10px] font-black uppercase tracking-widest animate-pulse">Trip in Progress</span>
                                                </div>
                                            )}
                                            {rideStatus === 'COMPLETED' && (
                                                <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{rideType === 'PASSENGER' ? 'Trip Completed' : 'Delivery Completed'}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            {(rideStatus === 'RINGING' || rideStatus === 'ACCEPTED' || rideStatus === 'ARRIVED' || rideStatus === 'NAVIGATING') ? (
                                <div className="flex flex-col items-end">
                                    {(rideType === 'DELIVERY' || rideType === 'MERCHANT_DELIVERY') && currentRide.total_cash_upfront ? (
                                        <div className="mb-4 w-full flex flex-col items-center justify-center bg-orange-50 dark:bg-orange-950/20 py-3 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                                            <div className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1">Needed Cash</div>
                                            <div className="text-orange-600 dark:text-orange-400 text-3xl font-black">D{Math.ceil(currentRide.total_cash_upfront)}</div>
                                        </div>
                                    ) : null}
                                    <div className="flex items-center gap-4 w-full justify-end">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1 opacity-60">Reveal fee at completion</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className="bg-gray-100 dark:bg-white/5 w-6 h-6 rounded-lg flex items-center justify-center">
                                                    <EyeOff size={12} className="text-gray-400" />
                                                </div>
                                                <span className="text-xl font-black text-gray-300 dark:text-zinc-600 tracking-tighter">D ••••</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : rideStatus === 'COMPLETED' ? (
                                <div className="animate-in zoom-in duration-300 flex flex-col items-end">
                                    <div className="text-gray-900 dark:text-white text-2xl font-black">D{Math.ceil(currentRide.price)}</div>
                                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                        <CheckCircle size={10} className="text-[#00E39A]" />
                                        {rideType === 'DELIVERY' ? 'Delivery Complete' : 'Ride Complete'}
                                    </div>
                                </div>
                            ) : rideStatus === 'RINGING' ? (
                                <>
                                    <div className="text-[#00E39A] text-3xl font-bold tracking-tight">D{currentRide.price}</div>
                                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{rideType === 'DELIVERY' ? 'Delivery Fee' : 'Estimated Fare'}</div>
                                </>
                            ) : (rideStatus === 'ACCEPTED' || rideStatus === 'ARRIVED') ? (
                                <div className="flex flex-col items-end">
                                    <div className="text-blue-500 dark:text-blue-400 text-sm font-black uppercase tracking-widest">{rideStatus === 'ACCEPTED' ? 'To Pickup' : 'At Pickup'}</div>
                                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{currentRide.pickupDistance} Away</div>
                                </div>
                            ) : (
                                <>
                                    <div className="text-[#00E39A] text-3xl font-bold tracking-tight">D{currentRide.price}</div>
                                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{rideType === 'DELIVERY' ? 'Fee' : 'Price'}</div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Route Visualizer */}
                    <div className={`relative pl-2 mb-3 transition-all duration-300 ${rideStatus === 'COMPLETED' ? 'opacity-40 grayscale' : ''}`}>
                        <div className="absolute left-[7px] top-3 bottom-8 w-[2px] bg-gray-200 dark:bg-[#2C2C2E]">
                            <div className={`absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-b from-[#00E39A] to-transparent ${isRideStarted ? 'h-full' : 'h-1/2'}`}></div>
                        </div>

                        {/* Pickup(s) */}
                        {currentRide.merchants && currentRide.merchants.length > 0 ? (
                            currentRide.merchants.map((merchant, index) => {
                                const isCurrentStop = (currentRide.current_stop_index || 0) === index;
                                const isCompleted = (currentRide.current_stop_index || 0) > index;
                                return (
                                    <div key={index} className={`flex gap-4 mb-6 relative z-10 ${isCompleted ? 'opacity-40' : ''}`}>
                                        <div className={`mt-1 w-4 h-4 rounded-full border-[3px] ${isCurrentStop ? 'border-orange-500 animate-pulse' : 'border-[#00E39A]'} bg-white dark:bg-[#1C1C1E] shrink-0 shadow-[0_0_10px_rgba(0,227,154,0.4)]`}></div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`${isCurrentStop ? 'text-orange-500' : 'text-[#00E39A]'} text-[10px] font-black uppercase tracking-widest`}>
                                                        PICKUP {currentRide.merchants!.length > 1 ? index + 1 : ''}
                                                        {isCurrentStop && ' (CURRENT)'}
                                                        {isCompleted && ' (DONE)'}
                                                    </span>
                                                    {index === 0 && <span className="bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 text-[10px] px-1.5 py-0.5 rounded">{currentRide.pickupDistance} Away</span>}
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-orange-500 text-[9px] font-black uppercase tracking-widest">D{merchant.amount}</span>
                                                </div>
                                            </div>
                                            <h4 className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{merchant.name}</h4>
                                            <p className="text-gray-500 text-xs truncate max-w-[200px]">{merchant.address}</p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : currentRide.stops && currentRide.stops.length > 0 ? (
                            currentRide.stops.map((stop: any, index: number) => {
                                const isObj = stop && typeof stop === 'object';
                                const name = isObj ? (stop.business_name || stop.name) : stop;
                                return (
                                    <div key={index} className="flex gap-4 mb-6 relative z-10">
                                        <div className="mt-1 w-4 h-4 rounded-full border-[3px] border-[#00E39A] bg-white dark:bg-[#1C1C1E] shrink-0 shadow-[0_0_10px_rgba(0,227,154,0.4)]"></div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[#00E39A] text-[10px] font-black uppercase tracking-widest">PICKUP {currentRide.stops!.length > 1 ? index + 1 : ''}</span>
                                                {index === 0 && <span className="bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 text-[10px] px-1.5 py-0.5 rounded">{currentRide.pickupDistance} Away</span>}
                                            </div>
                                            <h4 className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{name}</h4>
                                            {isObj && stop.business_address && <p className="text-gray-500 text-xs truncate max-w-[200px]">{stop.business_address}</p>}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex gap-4 mb-6 relative z-10">
                                <div className="mt-1 w-4 h-4 rounded-full border-[3px] border-[#00E39A] bg-white dark:bg-[#1C1C1E] shrink-0 shadow-[0_0_10px_rgba(0,227,154,0.4)]"></div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[#00E39A] text-[10px] font-black uppercase tracking-widest">PICKUP</span>
                                        <span className="bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 text-[10px] px-1.5 py-0.5 rounded">{currentRide.pickupDistance} Away</span>
                                    </div>
                                    <h4 className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{currentRide.businessName || currentRide.pickupLocation}</h4>
                                </div>
                            </div>
                        )}

                        {/* Destination - Masked until started */}
                        {!isRideStarted ? (
                            <div className="flex gap-4 mb-6 relative z-10 opacity-60">
                                <div className="mt-1 w-4 h-4 rounded-full border-[2px] border-dashed border-gray-400 bg-gray-50 dark:bg-zinc-800 shrink-0"></div>
                                <div className="flex-1 filter blur-[4px]">
                                    <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-0.5">DROP-OFF (GENERAL AREA)</div>
                                    <h4 className="text-gray-400 font-bold text-lg leading-tight">
                                        {currentRide.destination.split(',').slice(-2).join(',').trim() || 'General Area'}
                                    </h4>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-white/80 dark:bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                                        <EyeOff size={12} className="text-gray-400" />
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Address hidden until start</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-4 relative z-10">
                                <div className="mt-1 w-4 h-4 border-[2px] border-gray-400 dark:border-white bg-white dark:bg-[#1C1C1E] shrink-0 rounded-[2px]"></div>
                                <div>
                                    <div className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest mb-0.5">DROP-OFF</div>
                                    <h4 className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{currentRide.destination}</h4>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions Area */}
                    <div className={`pb-4 transition-all duration-300`}>
                        <div className="space-y-4">
                            {/* 1. Contextual Action Stack */}
                            {rideStatus === 'RINGING' && (
                                <div className="space-y-3">
                                    {rideType === 'DELIVERY' && currentRide.total_cash_upfront && !showCashConfirm ? (
                                        <button
                                            disabled={isProcessing}
                                            onClick={() => setShowCashConfirm(true)}
                                            className={`w-full bg-[#00E39A] hover:bg-[#00C285] active:scale-[0.98] transition-all h-14 rounded-full flex items-center justify-center shadow-lg ${isProcessing ? 'opacity-70' : ''}`}
                                        >
                                            <span className="text-black font-black text-lg tracking-wide uppercase">
                                                {isProcessing ? 'Processing...' : 'Take Delivery'}
                                            </span>
                                        </button>
                                    ) : showCashConfirm ? (
                                        <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-3xl border border-orange-200 dark:border-orange-800/30 animate-in zoom-in-95">
                                            <p className="text-orange-900 dark:text-orange-200 font-bold text-center mb-4">
                                                Do you have <span className="text-xl font-black">D{currentRide.total_cash_upfront}</span> cash for this delivery?
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => setShowCashConfirm(false)}
                                                    className="py-3 rounded-2xl bg-white dark:bg-zinc-800 text-gray-500 font-bold uppercase text-xs"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    disabled={isProcessing}
                                                    onClick={onAccept}
                                                    className={`py-3 rounded-2xl bg-orange-500 text-white font-black uppercase text-xs shadow-lg flex items-center justify-center gap-2 ${isProcessing ? 'opacity-70' : ''}`}
                                                >
                                                    {isProcessing && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                                                    {isProcessing ? 'Wait...' : 'Yes, I have it'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            disabled={isProcessing}
                                            onClick={onAccept}
                                            className={`w-full bg-[#00E39A] hover:bg-[#00C285] active:scale-[0.98] transition-all h-14 rounded-full flex items-center justify-between px-2 relative overflow-hidden shadow-lg ${isProcessing ? 'opacity-70' : ''}`}
                                        >
                                            <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center">
                                                {isProcessing ? (
                                                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                                ) : <Check size={20} className="text-black" />}
                                            </div>
                                            <span className="text-black font-black text-lg tracking-wide flex-1 text-center pr-12 uppercase">
                                                {isProcessing ? 'Processing...' : `Take ${rideType === 'DELIVERY' ? 'Delivery' : 'Ride'}`}
                                            </span>
                                            {!isProcessing && (
                                                <div className="absolute right-2 top-2 bottom-2 w-10 h-10 flex items-center justify-center">
                                                    <svg className="w-full h-full transform -rotate-90">
                                                        <circle cx="20" cy="20" r="18" stroke="black" strokeWidth="2" fill="none" opacity="0.1" />
                                                        <circle
                                                            cx="20" cy="20" r="18"
                                                            stroke="black" strokeWidth="2" fill="none"
                                                            strokeDasharray={113}
                                                            strokeDashoffset={113 - (113 * countdown) / 20}
                                                            className="transition-all duration-1000 ease-linear"
                                                        />
                                                    </svg>
                                                    <span className="absolute text-[10px] font-black text-black">{countdown}</span>
                                                </div>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}

                            {rideStatus === 'ACCEPTED' && (
                                <div className="space-y-2">
                                    <button
                                        disabled={isProcessing}
                                        onClick={onArrived}
                                        className={`w-full bg-[#00E39A] text-black h-14 rounded-2xl font-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-[0_8px_16px_rgba(0,227,154,0.3)] mb-1 uppercase tracking-widest ${isProcessing ? 'opacity-70' : ''}`}
                                    >
                                        {isProcessing ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                                                Please wait...
                                            </div>
                                        ) : (
                                            <>
                                                <MapPin size={24} />
                                                {rideType === 'MERCHANT_DELIVERY' ? 'Arrived at Pickup' : 'I Have Arrived'}
                                            </>
                                        )}
                                    </button>

                                    {/* Contact Buttons */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <a
                                            href={`tel:${rideType === 'MERCHANT_DELIVERY' && currentRide.merchants ? currentRide.merchants[currentRide.current_stop_index || 0]?.phone : currentRide.passengerPhone}`}
                                            className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-white h-11 rounded-xl font-black flex items-center justify-center gap-2 border border-gray-100 dark:border-white/5 active:scale-95 transition-transform text-sm"
                                        >
                                            <Phone size={16} fill="currentColor" /> CALL
                                        </a>
                                        <a
                                            href={`sms:${rideType === 'MERCHANT_DELIVERY' && currentRide.merchants ? currentRide.merchants[currentRide.current_stop_index || 0]?.phone : currentRide.passengerPhone}`}
                                            className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-white h-11 rounded-xl font-black flex items-center justify-center gap-2 border border-gray-100 dark:border-white/5 active:scale-95 transition-transform text-sm"
                                        >
                                            <MessageCircle size={16} fill="currentColor" /> SMS
                                        </a>
                                    </div>

                                    <SlideButton
                                        label={rideType === 'PASSENGER' ? "Slide to Cancel Ride" : "Slide to Cancel Delivery"}
                                        description="Emergency cancellation"
                                        onSlideComplete={onCancel}
                                        activeColor="#EF4444"
                                        baseColor="bg-red-50 dark:bg-red-900/10"
                                    />
                                </div>
                            )}

                            {rideStatus === 'ARRIVED' && (
                                <div className="space-y-2">
                                    <button
                                        disabled={isProcessing}
                                        onClick={onStartRide}
                                        className={`w-full bg-[#00E39A] text-black h-14 rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 shadow-lg uppercase tracking-widest font-black ${isProcessing ? 'opacity-70' : ''}`}
                                    >
                                        {isProcessing ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                                Starting...
                                            </div>
                                        ) : (
                                            <>
                                                <Play size={22} fill="currentColor" /> {rideType === 'MERCHANT_DELIVERY' ? 'START DELIVERY' : 'START TRIP'}
                                            </>
                                        )}
                                    </button>

                                    {/* Contact Buttons */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <a
                                            href={`tel:${rideType === 'MERCHANT_DELIVERY' && currentRide.merchants ? currentRide.merchants[currentRide.current_stop_index || 0]?.phone : currentRide.passengerPhone}`}
                                            className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-white h-11 rounded-xl font-black flex items-center justify-center gap-2 border border-gray-100 dark:border-white/5 active:scale-95 transition-transform text-sm"
                                        >
                                            <Phone size={16} fill="currentColor" /> CALL
                                        </a>
                                        <a
                                            href={`sms:${rideType === 'MERCHANT_DELIVERY' && currentRide.merchants ? currentRide.merchants[currentRide.current_stop_index || 0]?.phone : currentRide.passengerPhone}`}
                                            className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-white h-11 rounded-xl font-black flex items-center justify-center gap-2 border border-gray-100 dark:border-white/5 active:scale-95 transition-transform text-sm"
                                        >
                                            <MessageCircle size={16} fill="currentColor" /> SMS
                                        </a>
                                    </div>

                                    <SlideButton
                                        label={rideType === 'PASSENGER' ? "Slide to Cancel Ride" : "Slide to Cancel Delivery"}
                                        description="Emergency cancellation"
                                        onSlideComplete={onCancel}
                                        activeColor="#EF4444"
                                        baseColor="bg-red-50 dark:bg-red-900/10"
                                    />
                                </div>
                            )}

                            {rideStatus === 'NAVIGATING' && (
                                <div className="space-y-2">
                                    {rideStatus === 'NAVIGATING' && (
                                        <button
                                            disabled={isProcessing}
                                            onClick={onComplete}
                                            className={`w-full bg-[#00E39A] text-black h-14 rounded-2xl font-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-[0_8px_20px_rgba(0,227,154,0.3)] uppercase tracking-widest ${isProcessing ? 'opacity-70' : ''}`}
                                        >
                                            {isProcessing ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                                                    ENDING...
                                                </div>
                                            ) : (
                                                <>
                                                    <CheckCircle size={24} /> 
                                                    {rideType === 'PASSENGER' ? 'FINISH RIDE' : 'FINISH DELIVERY'}
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <div className="space-y-3">
                                        {rideType === 'MERCHANT_DELIVERY' && (
                                            <div className="grid grid-cols-2 gap-3 mb-2">
                                                <a
                                                    href={`tel:${currentRide?.passengerPhone}`}
                                                    className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-white h-14 rounded-2xl font-black flex items-center justify-center gap-2 border border-gray-100 dark:border-white/5 active:scale-95 transition-transform"
                                                >
                                                    <Phone size={18} fill="currentColor" /> CALL
                                                </a>
                                                <a
                                                    href={`https://wa.me/${currentRide?.passengerPhone}`}
                                                    className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-white h-14 rounded-2xl font-black flex items-center justify-center gap-2 border border-gray-100 dark:border-white/5 active:scale-95 transition-transform"
                                                >
                                                    <MessageCircle size={18} fill="currentColor" /> WHATSAPP
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    <SlideButton
                                        label={rideType === 'PASSENGER' ? "Slide to End Ride" : "Slide to End Delivery"}
                                        description="Emergency end session"
                                        onSlideComplete={onCancel}
                                        activeColor="#EF4444"
                                        baseColor="bg-red-50 dark:bg-red-900/10"
                                    />
                                </div>
                            )}

                            {rideStatus === 'COMPLETED' && (
                                <div className="space-y-3">
                                    <button
                                        onClick={onCollectPayment}
                                        className="w-full bg-[#00E39A] text-black h-14 rounded-2xl font-black active:scale-95 transition-transform mt-1 shadow-lg hover:bg-[#00C285] flex items-center justify-center gap-2"
                                    >
                                        <Wallet size={20} /> Collect Payment
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="w-full bg-white dark:bg-zinc-800 text-gray-900 dark:text-white h-14 rounded-2xl font-black active:scale-95 transition-transform flex items-center justify-center gap-2 border border-gray-100 dark:border-white/5"
                                    >
                                        <CheckCircle size={20} className="text-[#00E39A]" /> Okay
                                    </button>
                                </div>
                            )}

                            {/* 2. Secondary Support Actions (SMS Integration) */}
                            {rideStatus !== 'IDLE' && rideStatus !== 'RINGING' && rideStatus !== 'COMPLETED' && rideStatus !== 'NAVIGATING' && (
                                <a
                                    href={`sms:${currentRide.passengerPhone}`}
                                    className="w-full bg-gray-100 dark:bg-[#2C2C2E] text-gray-900 dark:text-white h-14 rounded-2xl flex items-center justify-center border border-gray-200 dark:border-gray-700 font-black text-sm uppercase tracking-widest gap-2 active:scale-95 transition-transform"
                                >
                                    <MessageSquare size={18} /> {rideType === 'PASSENGER' ? 'Message Passenger' : 'Message Customer'}
                                </a>
                            )}

                            {/* 3. Pre-trip Cancellation (SMALL RED BUTTON) */}
                            {rideStatus === 'RINGING' && (
                                <button
                                    onClick={onDecline}
                                    className="w-full py-4 text-red-500 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/10 rounded-2xl active:scale-95 transition-transform"
                                >
                                    <X size={18} /> Decline {rideType === 'PASSENGER' ? 'Ride' : 'Delivery'}
                                </button>
                            )}


                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
