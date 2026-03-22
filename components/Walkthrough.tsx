import React, { useState, useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { X, ChevronRight } from 'lucide-react';

export const Walkthrough: React.FC = () => {
    const { 
        isWalkthroughOpen, 
        walkthroughSteps, 
        currentWalkthroughIndex, 
        nextWalkthroughStep, 
        skipWalkthrough,
        isDarkMode 
    } = useUI();

    const [spotlightRect, setSpotlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

    const currentStep = walkthroughSteps[currentWalkthroughIndex];

    useEffect(() => {
        if (!isWalkthroughOpen || !currentStep?.targetId) {
            setSpotlightRect(null);
            return;
        }

        const updateSpotlight = () => {
            const element = document.getElementById(currentStep.targetId);
            if (element) {
                const rect = element.getBoundingClientRect();
                setSpotlightRect({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                });
            } else {
                setSpotlightRect(null);
            }
        };

        // Update immediately and on window resize
        updateSpotlight();
        window.addEventListener('resize', updateSpotlight);
        
        // Poll for the element during screen transitions
        const interval = setInterval(updateSpotlight, 100);
        const timer = setTimeout(() => clearInterval(interval), 1000);

        return () => {
            window.removeEventListener('resize', updateSpotlight);
            clearInterval(interval);
            clearTimeout(timer);
        };
    }, [isWalkthroughOpen, currentStep?.targetId]);

    if (!isWalkthroughOpen || walkthroughSteps.length === 0) return null;

    const isLastStep = currentWalkthroughIndex === walkthroughSteps.length - 1;

    return (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center px-4 pb-28">
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .spotlight-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    pointer-events: none;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    clip-path: polygon(
                        0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                        var(--s-left) var(--s-top),
                        var(--s-right) var(--s-top),
                        var(--s-right) var(--s-bottom),
                        var(--s-left) var(--s-bottom),
                        var(--s-left) var(--s-top)
                    );
                }
            `}</style>

            {/* Spotlight Overlay */}
            {spotlightRect && (
                <div 
                    className="spotlight-overlay"
                    style={{
                        '--s-top': `${spotlightRect.top - 8}px`,
                        '--s-left': `${spotlightRect.left - 8}px`,
                        '--s-right': `${spotlightRect.left + spotlightRect.width + 8}px`,
                        '--s-bottom': `${spotlightRect.top + spotlightRect.height + 8}px`
                    } as any}
                />
            )}
            
            <div className={`w-full max-w-sm relative z-10 animate-slide-up ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-100'} border-2 rounded-[32px] p-6 shadow-2xl shadow-black/20`}>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-1.5">
                        {walkthroughSteps.map((_, idx) => (
                            <div 
                                key={idx} 
                                className={`h-1 rounded-full transition-all duration-300 ${
                                    idx === currentWalkthroughIndex 
                                        ? 'w-6 bg-[#00E39A]' 
                                        : 'w-2 bg-slate-200 dark:bg-zinc-800'
                                }`}
                            />
                        ))}
                    </div>
                    <button 
                        onClick={skipWalkthrough}
                        className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {currentStep.title}
                </h3>
                <p className={`text-sm font-medium leading-relaxed mb-8 ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                    {currentStep.content}
                </p>

                <div className="flex gap-3">
                    <button 
                        onClick={skipWalkthrough}
                        className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all ${
                            isDarkMode ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-500'
                        }`}
                    >
                        Skip
                    </button>
                    <button 
                        onClick={nextWalkthroughStep}
                        className="flex-[2] py-4 bg-[#00E39A] text-slate-900 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00E39A]/20 active:scale-95 transition-all"
                    >
                        {isLastStep ? 'Got it!' : 'Next'}
                        {!isLastStep && <ChevronRight size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
};
