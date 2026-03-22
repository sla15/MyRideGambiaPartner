import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { NoConnectionModal } from './components/NoConnectionModal';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

const AppContent: React.FC = () => {
  const { isOnboarded, secondaryOnboardingRole, isLoading, isDarkMode } = useApp();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleFirstInteraction = () => {
      import('./utils/fcm').then(({ unlockAudio }) => unlockAudio());
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    // Initialize Plugins
    const initPlugins = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Status Bar
          await StatusBar.setOverlaysWebView({ overlay: true });
          await StatusBar.setStyle({ style: isDarkMode ? Style.Dark : Style.Light });
          await StatusBar.setBackgroundColor({ color: 'transparent' });
          
          // Keyboard
          if (Capacitor.getPlatform() === 'ios') {
            await Keyboard.setAccessoryBarVisible({ isVisible: false });
          }
        } catch (e) {
          console.warn('Capacitor plugin error:', e);
        }
      }
    };

    // Network Status
    const checkNetwork = async () => {
      const status = await Network.getStatus();
      setIsOnline(status.connected);
    };

    const networkListener = Network.addListener('networkStatusChange', status => {
      setIsOnline(status.connected);
    });

    initPlugins();
    checkNetwork();

    return () => {
      networkListener.then(l => l.remove());
    };
  }, [isDarkMode]);

  if (!isOnline) {
    return <NoConnectionModal />;
  }

  // Show loading screen during initialization
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show onboarding if not onboarded OR if user is adding a new role (secondary onboarding)
  const showOnboarding = !isOnboarded || secondaryOnboardingRole !== null;

  return showOnboarding ? <OnboardingScreen /> : <Layout />;
}

import { ErrorBoundary } from './components/ErrorBoundary';
import { VersionCheckModal } from './components/VersionCheckModal';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
        <VersionCheckModal />
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;