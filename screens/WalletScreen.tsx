
import React from 'react';
import { useApp } from '../context/AppContext';
import { Wallet, ArrowLeft } from 'lucide-react';
import { DriverWalletView } from './DriverWalletView';
import { MerchantWalletView } from './MerchantWalletView';
import { ManualPaymentScreen } from './ManualPaymentScreen';

export const WalletScreen: React.FC = () => {
  const { role, setCurrentTab, isLocked } = useApp();
  const [showManualPayment, setShowManualPayment] = React.useState(false);

  React.useEffect(() => {
    const handleOpenManual = () => setShowManualPayment(true);
    window.addEventListener('open-manual-payment', handleOpenManual);
    return () => window.removeEventListener('open-manual-payment', handleOpenManual);
  }, []);

  const handleBack = () => {
    if (!isLocked) {
      setCurrentTab(role === 'DRIVER' ? 'home' : 'orders');
    }
  };

  return (
    <div className={`h-full flex flex-col transition-colors overflow-hidden ${isLocked ? 'bg-red-50 dark:bg-red-950/20' : 'bg-slate-50 dark:bg-black'}`}>
      {/* Universal Header */}
      {!showManualPayment && (
        <div className={`px-6 pt-safe pb-4 flex items-center justify-between shrink-0 z-10 border-b transition-colors ${isLocked ? 'bg-red-100 dark:bg-black border-red-200 dark:border-red-900/30' : 'bg-white dark:bg-black border-slate-100 dark:border-zinc-800'}`}>
          <button
            onClick={handleBack}
            disabled={isLocked}
            className={`p-2 -ml-2 transition-all ${isLocked ? 'text-red-300 dark:text-red-900 opacity-50 cursor-not-allowed' : 'text-slate-900 dark:text-white active:scale-90'}`}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Wallet</h1>
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <Wallet size={20} className="text-orange-500" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {showManualPayment ? (
          <ManualPaymentScreen onBack={() => setShowManualPayment(false)} />
        ) : (
          role === 'DRIVER' ? <DriverWalletView /> : <MerchantWalletView />
        )}
      </div>
    </div>
  );
};
