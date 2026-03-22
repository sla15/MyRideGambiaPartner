
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

import { Walkthrough } from './Walkthrough';
import { Preferences } from '@capacitor/preferences';

export const Layout: React.FC = () => {
  const { 
    role, 
    activeChat, 
    closeChat, 
    currentTab, 
    setCurrentTab, 
    isDarkMode, 
    isLocked, 
    profile, 
    startWalkthrough, 
    isWalkthroughOpen,
    updateActiveRole
  } = useApp();

  // Walkthrough Logic
  React.useEffect(() => {
    const checkWalkthrough = async () => {
      const { value: driverDone } = await Preferences.get({ key: 'walkthrough_driver_completed' });
      const { value: merchantDone } = await Preferences.get({ key: 'walkthrough_merchant_completed' });

      const hasVehicle = profile.vehicle;
      const hasBusiness = profile.business;
      const isBoth = hasVehicle && hasBusiness;
      
      const driverSteps = [
        {
          id: 'driver-dash',
          targetId: 'nav-home',
          title: 'Driver Dashboard',
          content: 'This is where you see and accept ride requests in real-time.',
          nextTab: 'home'
        },
        {
          id: 'driver-wallet-nav',
          targetId: 'nav-wallet',
          title: 'Earnings & Wallet',
          content: 'Tap the Wallet icon to view your balance and pay commissions.',
          nextTab: 'home' // Stay on home to show the navbar icon
        },
        {
          id: 'driver-wallet-explain',
          targetId: '',
          title: 'Your Wallet',
          content: 'Welcome! Track all your transactions and payouts here.',
          nextTab: 'wallet' // Now switch to wallet
        },
        {
          id: 'driver-profile',
          targetId: 'nav-profile',
          title: 'Your Profile',
          content: 'Manage your vehicle details and account settings here.',
          nextTab: 'profile'
        }
      ];

      const merchantSteps = [
        {
          id: 'merchant-dash',
          targetId: 'nav-orders',
          title: 'Orders Management',
          content: 'Monitor your incoming orders and manage business status here.',
          nextTab: 'orders'
        },
        {
          id: 'merchant-products',
          targetId: 'nav-products',
          title: 'Product Catalog',
          content: 'Tap the store icon to add items, update prices, and managing stock.',
          nextTab: 'products'
        },
        {
          id: 'merchant-wallet',
          targetId: 'nav-wallet',
          title: 'Business Earnings',
          content: 'Track your daily sales and request payouts from your wallet.',
          nextTab: 'wallet'
        }
      ];

      if (isBoth) {
        // If they are both, we only show the ones they haven't finished
        const steps = [];
        
        if (driverDone !== 'true') {
          steps.push(
            {
              id: 'start-both-driver',
              targetId: '',
              title: 'Driver Mode',
              content: "Let's start with your Driver dashboard. This is where you'll make money!",
              action: async () => {
                await updateActiveRole('DRIVER');
                setCurrentTab('home');
              }
            },
            ...driverSteps,
            {
              id: 'driver-finished',
              targetId: '',
              title: 'Driver Tour Done',
              content: "Great! Now you know how the driver side works. Let's switch to Merchant mode.",
              action: async () => {
                await Preferences.set({ key: 'walkthrough_driver_completed', value: 'true' });
              }
            }
          );
        }

        if (merchantDone !== 'true') {
          steps.push(
            {
              id: 'switch-to-merchant',
              targetId: 'nav-profile',
              title: 'Switching Mode',
              content: 'To switch roles, you can always go to your Profile.',
              action: async () => {
                await updateActiveRole('MERCHANT');
                setCurrentTab('orders');
              }
            },
            ...merchantSteps,
            {
              id: 'merchant-finished',
              targetId: '',
              title: 'All Set!',
              content: 'You have completed the full walkthrough. Welcome to the partner platform!',
              action: async () => {
                await Preferences.set({ key: 'walkthrough_merchant_completed', value: 'true' });
              }
            }
          );
        }

        if (steps.length > 0) {
          startWalkthrough([
            ...steps,
            {
              id: 'done',
              targetId: '',
              title: 'All Set!',
              content: 'You are ready to go. Good luck!',
            }
          ]);
        }
      } else if (role === 'DRIVER' && driverDone !== 'true') {
        startWalkthrough([
          ...driverSteps,
          {
            id: 'done',
            targetId: '',
            title: 'Welcome Driver!',
            content: 'You are ready to start. Go online to receive requests.',
            action: async () => {
              await Preferences.set({ key: 'walkthrough_driver_completed', value: 'true' });
            }
          }
        ]);
      } else if (role === 'MERCHANT' && merchantDone !== 'true') {
        startWalkthrough([
          ...merchantSteps,
          {
            id: 'done',
            targetId: '',
            title: 'Welcome Merchant!',
            content: 'Start adding your products to receive orders.',
            action: async () => {
              await Preferences.set({ key: 'walkthrough_merchant_completed', value: 'true' });
            }
          }
        ]);
      }
    };

    if (profile.name) { // Only start if profile is loaded
      checkWalkthrough();
    }
  }, [profile.name]);

  // Auto-switch to wallet if locked
  React.useEffect(() => {
    if (isLocked && currentTab !== 'wallet') {
      setCurrentTab('wallet');
    }
  }, [isLocked, currentTab, setCurrentTab]);

  // Notification Deep Linking
  React.useEffect(() => {
    const handleNotificationTap = (e: any) => {
      const data = e.detail;
      console.log("👆 Partner Notification tapped, routing to:", data);
      if (data?.type === 'NEW_ORDER' && role === 'MERCHANT') {
        setCurrentTab('orders');
      } else if ((data?.type === 'ride_update' || data?.type === 'ride_request' || data?.ride_id) && role === 'DRIVER') {
        setCurrentTab('home');
      }
    };

    window.addEventListener('notification_tapped', handleNotificationTap);
    return () => window.removeEventListener('notification_tapped', handleNotificationTap);
  }, [role, setCurrentTab]);

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
      <Walkthrough />

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
