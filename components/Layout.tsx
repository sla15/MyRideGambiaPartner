
import React from 'react';
import { useApp } from '../context/AppContext';
import { FloatingNav } from './FloatingNav';
import { NotificationBanner } from './NotificationBanner';
import { DriverHome } from '../screens/DriverHome';
import { MerchantOrders } from '../screens/MerchantOrders';
import { ProductManagement } from '../screens/ProductManagement';
import { WalletScreen } from '../screens/WalletScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export const Layout: React.FC = () => {
  const { role, activeChat, closeChat, currentTab, setCurrentTab, isDarkMode, isLocked } = useApp();

  // Auto-switch to wallet if locked
  React.useEffect(() => {
    if (isLocked && currentTab !== 'wallet') {
      setCurrentTab('wallet');
    }
  }, [isLocked, currentTab, setCurrentTab]);

  // Hardware Back Button Handling
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backListener = App.addListener('backButton', ({ canGoBack }) => {
      if (activeChat) {
        // 1. If chat is open, close it
        closeChat();
      } else if (currentTab !== (role === 'DRIVER' ? 'home' : 'orders')) {
        // 2. If not on home/orders tab, go there
        setCurrentTab(role === 'DRIVER' ? 'home' : 'orders');
      } else if (canGoBack) {
        // 3. Fallback to browser history if possible
        window.history.back();
      } else {
        // 4. Fully exit app if on home and no history
        App.exitApp();
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [activeChat, closeChat, currentTab, setCurrentTab, role]);

  const renderScreen = () => {
    if (role === 'DRIVER') {
      switch (currentTab) {
        case 'home': return <DriverHome />;
        case 'wallet': return <WalletScreen />;
        case 'profile': return <ProfileScreen />;
        default: return <DriverHome />;
      }
    } else {
      switch (currentTab) {
        case 'orders': return <MerchantOrders />;
        case 'products': return <ProductManagement />;
        case 'wallet': return <WalletScreen />;
        case 'profile': return <ProfileScreen />;
        default: return <MerchantOrders />;
      }
    }
  };

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden relative transition-colors duration-300 
      ${isLocked ? 'border-4 border-red-600' : ''} 
      ${isDarkMode ? 'bg-black text-white' : 'bg-white text-slate-900'}`}>
      <NotificationBanner />

      {/* Screen Content */}
      <main className="flex-1 h-full overflow-hidden relative">
        {renderScreen()}
      </main>

      {/* Overlays */}
      {activeChat && <ChatScreen />}

      {/* Navigation (Hide when chat is open or ride is active for cleaner look) */}
      {!activeChat && (
        <FloatingNav
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          isVisible={!useApp().rideStatus || useApp().rideStatus === 'IDLE'}
        />
      )}
    </div>
  );
};
