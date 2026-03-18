
import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const NoConnectionModal: React.FC = () => {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-white dark:bg-black flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
      <div className="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-[2rem] flex items-center justify-center mb-8 animate-bounce">
        <WifiOff size={48} className="text-red-500" />
      </div>
      
      <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 text-center tracking-tight">
        No Connection
      </h2>
      
      <p className="text-slate-500 dark:text-slate-400 text-center text-lg font-medium max-w-[280px] mb-12 leading-relaxed">
        It looks like you're offline. Please check your internet connection and try again.
      </p>
      
      <button 
        onClick={handleRetry}
        className="w-full max-w-[280px] bg-slate-900 dark:bg-white text-white dark:text-black font-black py-5 rounded-[22px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
      >
        <RefreshCw size={20} />
        Try Again
      </button>
      
      <p className="absolute bottom-12 text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.2em]">
        DROPOFF Network
      </p>
    </div>
  );
};
