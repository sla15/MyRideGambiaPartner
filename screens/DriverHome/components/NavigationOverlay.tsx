
import React from 'react';
import { Navigation, X, ArrowRight, TrendingUp } from 'lucide-react';

// Helper: get today's local earnings from localStorage (auto-resets per day)
const getTodayEarnings = (): number => {
    try {
        const todayKey = `todayEarnings_${new Date().toISOString().slice(0, 10)}`;
        return parseFloat(localStorage.getItem(todayKey) || '0');
    } catch {
        return 0;
    }
};

interface NavigationOverlayProps {
    rideStatus: string;
    currentRide: any;
    showDirections: boolean;
    setShowDirections: (val: boolean) => void;
    navigationInfo: { distance: string; duration: string };
    dragPos: { x: number; y: number };
    handleDragStart: (e: React.TouchEvent | React.MouseEvent) => void;
    isDragging: boolean;
}

export const NavigationOverlay: React.FC<NavigationOverlayProps> = ({
    rideStatus,
    currentRide,
    showDirections,
    setShowDirections,
    navigationInfo,
    dragPos,
    handleDragStart,
    isDragging
}) => {
    if (!(rideStatus === 'ACCEPTED' || rideStatus === 'NAVIGATING') || !currentRide) return null;

    const todayEarnings = getTodayEarnings();

    return (
        <>
            <div
                className="absolute z-[60] cursor-grab active:cursor-grabbing touch-none"
                style={{ top: dragPos.y, left: dragPos.x }}
                onTouchStart={handleDragStart}
                onMouseDown={handleDragStart}
            >
                <button
                    onClick={() => { if (!isDragging) setShowDirections(!showDirections); }}
                    className="w-14 h-14 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white shadow-xl"
                >
                    {showDirections ? <X size={24} /> : <Navigation size={24} />}
                </button>
            </div>

            {showDirections && (
                <div className="absolute top-14 left-4 right-4 z-50">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-4 flex gap-4 items-center animate-in slide-in-from-top duration-300">
                        <div className="w-14 h-14 bg-[#1E2D23] rounded-xl flex items-center justify-center shrink-0 border border-[#00E39A]/20">
                            <ArrowRight size={32} className="text-[#00E39A]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[#00E39A] font-bold text-2xl">{navigationInfo.distance}</p>
                            <p className="text-gray-900 dark:text-white font-bold text-lg leading-tight truncate">
                                {rideStatus === 'ACCEPTED' ? `Pickup: ${currentRide.pickupLocation}` : `Heading to: ${currentRide.destination}`}
                            </p>
                            <p className="text-gray-400 text-xs mt-0.5">Estimated time: {navigationInfo.duration}</p>
                        </div>
                    </div>

                    {/* Today's Earnings Strip */}
                    <div className="mt-2 bg-black/70 backdrop-blur-md rounded-xl px-4 py-2.5 flex items-center gap-2 border border-[#00E39A]/20">
                        <TrendingUp size={16} className="text-[#00E39A] shrink-0" />
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Today's Earnings</span>
                        <span className="ml-auto text-[#00E39A] font-black text-base">D{Math.ceil(todayEarnings)}</span>
                    </div>
                </div>
            )}
        </>
    );
};
