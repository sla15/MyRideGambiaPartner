
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Toggle } from '../components/Toggle';
import { Car, Star, LogOut, Moon, ArrowLeft, Store, Users, Trash2, ChevronRight, Camera as CameraIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { supabase } from '../lib/supabase';
import { Role } from '../types';
import { ProfileDriverView } from './ProfileDriverView';
import { ProfileMerchantView } from './ProfileMerchantView';
import { Phone, MessageCircle, Mail, Bell } from 'lucide-react';
import { sendPushNotification } from '../utils/helpers';
import { requestNotificationPermission, initFCM } from '../utils/fcm';


export const ProfileScreen: React.FC = () => {
  const {
    role, updateActiveRole, profile, isDarkMode, toggleTheme,
    pushNotification, startSecondaryOnboarding, setCurrentTab,
    uploadFile, updateProfile, syncProfile, signOut, showAlert,
    requestAccountDeletion, appSettings
  } = useApp();
  const [showSupportDrawer, setShowSupportDrawer] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(
    typeof window !== 'undefined' ? (window.Notification?.permission === 'granted') : false
  );

  const handleRoleSwitch = (targetRole: Role) => {
    if (targetRole === 'DRIVER') {
      if (!profile.vehicle) startSecondaryOnboarding('DRIVER');
      else { updateActiveRole('DRIVER'); setCurrentTab('home'); pushNotification('Driver Mode', 'Active', 'SYSTEM'); }
    } else {
      if (!profile.business) startSecondaryOnboarding('MERCHANT');
      else { updateActiveRole('MERCHANT'); setCurrentTab('orders'); pushNotification('Merchant Mode', 'Active', 'SYSTEM'); }
    }
  };

  const handleBack = () => {
    setCurrentTab(role === 'DRIVER' ? 'home' : 'orders');
  };

  const handleOpenSupport = () => {
    setShowSupportDrawer(true);
  };

  const isDriverOnly = profile.vehicle && !profile.business;
  const isMerchantOnly = !profile.vehicle && profile.business;

  // Header branding logic: Driver profile shows personal info (preferring driver-specific pic), Merchant profile shows business info
  const displayName = role === 'DRIVER' ? profile.name : (profile.business?.businessName || profile.name);
  const displayImage = role === 'DRIVER' ? (profile.driverProfilePic || profile.image) : profile.business?.logo;

  const getInitials = (userName: string) => {
    if (!userName) return 'DP';
    const names = userName.split(' ');
    if (names.length >= 2) return (names[0][0] + names[1][0]).toUpperCase();
    return (userName[0] + (userName[1] || '')).toUpperCase();
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-black transition-colors duration-300 overflow-hidden">
      <div className="flex items-center gap-4 px-6 pt-14 pb-6 shrink-0 z-10 bg-white dark:bg-[#121212] border-b border-slate-100 dark:border-zinc-900 transition-colors">
        <button onClick={handleBack} className="w-11 h-11 rounded-full bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-900 dark:text-white active:scale-90 transition-transform"><ArrowLeft size={22} /></button>
        <div className="flex-1 text-center font-black text-slate-900 dark:text-white text-xl mr-11 tracking-tight">Profile</div>
      </div>

      {isDeleting && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl flex flex-col items-center gap-4 shadow-2xl">
            <div className="w-12 h-12 border-4 border-[#00E39A] border-t-transparent rounded-full animate-spin" />
            <p className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs">Deleting Account...</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {/* Profile Header */}
        <div className="flex flex-col items-center my-10 shrink-0 px-6">
          <div className="relative mb-6">
            <div className="w-[124px] h-[124px] rounded-full p-1 bg-gradient-to-b from-[#00E39A]/40 to-transparent relative group cursor-pointer" 
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  try {
                    const image = await Camera.getPhoto({
                      quality: 90,
                      allowEditing: false,
                      resultType: CameraResultType.Uri,
                      source: CameraSource.Prompt
                    });


                    if (image.webPath) {
                      const response = await fetch(image.webPath);
                      const blob = await response.blob();
                      
                      const bucket = 'avatars';
                      const url = await uploadFile(blob, bucket, `${Date.now()}_avatar.jpg`);

                      if (url) {
                        if (role === 'MERCHANT') {
                          const updatedBusiness = { ...profile.business!, logo: url };
                          updateProfile({ business: updatedBusiness });
                          await syncProfile({ ...profile, business: updatedBusiness });
                        } else {
                          updateProfile({ driverProfilePic: url });
                          await syncProfile({ ...profile, driverProfilePic: url });
                        }
                      }
                    }
                  } catch (err) {
                    console.warn("Camera/Gallery cancelled or failed:", err);
                  }
                } else {
                  document.getElementById('prof-avatar-input')?.click();
                }
              }}
            >

              <div className="w-full h-full rounded-full border-[5px] border-white dark:border-[#121212] overflow-hidden shadow-xl bg-slate-100 dark:bg-zinc-800 relative flex items-center justify-center">
                {displayImage ? (
                  <img
                    src={displayImage}
                    className="w-full h-full object-cover"
                    alt={displayName}
                  />
                ) : (
                  <span className="text-3xl font-black text-slate-400 dark:text-slate-500 tracking-tighter">
                    {getInitials(displayName)}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <CameraIcon className="text-white" size={24} />
                </div>

              </div>
              <input
                id="prof-avatar-input"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  // Determine bucket based on role to keep organized
                  const bucket = 'avatars'; // Use 'avatars' for both user profiles and merchant logos
                  const url = await uploadFile(file, bucket, `${Date.now()}_${file.name}`);

                  if (url) {
                    if (role === 'MERCHANT') {
                      // Update Business Logo ONLY. usage of 'image' here would overwrite driver avatar.
                      const updatedBusiness = { ...profile.business!, logo: url };
                      // Only update business state. Do NOT touch profile.image
                      updateProfile({ business: updatedBusiness });
                      await syncProfile({ ...profile, business: updatedBusiness }); // Pass CLEAN profile, don't inject 'image'
                    } else {
                      // Update Driver/User Avatar - Prefer Driver Profile Pic
                      updateProfile({ driverProfilePic: url });
                      await syncProfile({ ...profile, driverProfilePic: url });
                    }
                  }
                }}
              />
            </div>
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-900 px-4 py-1 rounded-full shadow-lg border border-slate-50 dark:border-slate-800 flex items-center gap-1.5`}>
              <div className={`w-2.5 h-2.5 rounded-full ${profile.isOnline ? 'bg-[#00E39A] animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[11px] font-black text-slate-900 dark:text-white tracking-widest uppercase">
                {profile.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          <h1 className="text-[28px] font-black text-slate-900 dark:text-white mb-1 tracking-tight text-center leading-tight">{displayName}</h1>
          <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
            <span>{role === 'DRIVER' ? 'Driver Partner' : 'Merchant Partner'}</span>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1 text-[#00E39A]">
              <Star size={14} fill="currentColor" /> {profile.rating}
            </div>
          </div>
        </div>

        {/* Unified Mode Toggle */}
        <div className="mx-6 bg-white dark:bg-zinc-900 p-2 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm shrink-0 mb-8">
          <div className="flex p-1 bg-slate-50 dark:bg-black rounded-[18px] relative">
            {/* Animated Background Indicator (simplified for React) */}
            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-[14px] bg-[#00E39A] shadow-lg transition-all duration-300 ${role === 'MERCHANT' ? 'translate-x-[calc(100%+4px)]' : 'left-1'}`} />

            <button
              onClick={() => handleRoleSwitch('DRIVER')}
              className={`relative z-10 flex-1 py-3.5 text-[13px] font-black rounded-[14px] transition-all flex items-center justify-center gap-2 ${role === 'DRIVER' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              <Car size={16} fill={role === 'DRIVER' ? 'currentColor' : 'none'} />
              {profile.vehicle ? 'Driver Mode' : 'Become a Driver'}
            </button>
            <button
              onClick={() => handleRoleSwitch('MERCHANT')}
              className={`relative z-10 flex-1 py-3.5 text-[13px] font-black rounded-[14px] transition-all flex items-center justify-center gap-2 ${role === 'MERCHANT' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              <Store size={16} fill={role === 'MERCHANT' ? 'currentColor' : 'none'} />
              {profile.business ? 'Merchant Mode' : 'Become a Merchant'}
            </button>
          </div>
        </div>

        {/* Dynamic Profile View */}
        {role === 'DRIVER' ? <ProfileDriverView /> : <ProfileMerchantView />}

        {/* Account Settings Group */}
        <div className="mx-6 mt-8 space-y-4 mb-20">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Account Settings</p>

          <div className="bg-white dark:bg-zinc-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Appearance */}
            <div className="p-4 flex items-center justify-between border-b border-slate-50 dark:border-zinc-800/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"><Moon size={20} /></div>
                <div className="text-left">
                  <p className="font-bold text-[15px] text-slate-900 dark:text-white">Dark Mode</p>
                </div>
              </div>
              <Toggle checked={isDarkMode} onChange={toggleTheme} />
            </div>

            {/* Push Notifications */}
            <div className="p-4 flex items-center justify-between border-b border-slate-50 dark:border-zinc-800/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"><Bell size={20} /></div>
                <div className="text-left">
                  <p className="font-bold text-[15px] text-slate-900 dark:text-white">Push Notifications</p>
                  <p className="text-[11px] text-slate-400 font-medium">Get alerts for new requests</p>
                </div>
              </div>
              <Toggle 
                checked={isNotificationsEnabled} 
                onChange={async () => {
                  if (!isNotificationsEnabled) {
                    const granted = await requestNotificationPermission();
                    if (granted) {
                      setIsNotificationsEnabled(true);
                      if (profile.id || (supabase.auth.getSession().then(({data}) => data.session?.user.id))) {
                         const userId = profile.id || (await supabase.auth.getUser()).data.user?.id;
                         if (userId) initFCM(userId);
                      }
                      pushNotification('Success', 'Notifications enabled', 'SYSTEM');
                    } else {
                      showAlert('Permission Denied', 'Please enable notifications in your browser/device settings.');
                    }
                  } else {
                    showAlert('Info', 'To disable notifications, please change your browser/device settings.');
                  }
                }} 
              />
            </div>

            {/* Sign Out */}
            <button
              onClick={signOut}
              className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors text-left border-b border-slate-50 dark:border-zinc-800/50"
            >
              <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"><LogOut size={20} /></div>
              <div>
                <p className="font-bold text-[15px] text-slate-900 dark:text-white">Sign Out</p>
              </div>
            </button>

            {/* Delete Account */}
            <button
              onClick={() => {
                showAlert(
                  'Delete Account',
                  'Are you sure you want to delete your account? This action cannot be undone and will remove your access to the platform.',
                  async () => {
                    setIsDeleting(true);
                    try {
                      const result = await requestAccountDeletion();
                      if (result.success) {
                        await signOut();
                      } else if (result.error === 'DEBT_BLOCK') {
                        const msg = `You cannot delete your account yet. You have a commission debt of D${result.debtAmount}. Please pay the debt first using our Wave business number: 388 8888. Tap OK to copy the number.`;
                        showAlert('Action Required', msg, () => {
                          navigator.clipboard.writeText('388 8888');
                          pushNotification('Copied', 'Wave number copied to clipboard', 'SYSTEM');
                        });
                      } else {
                        pushNotification('Error', result.error || 'Could not submit deletion request.', 'SYSTEM');
                      }
                    } finally {
                      setIsDeleting(false);
                    }
                  },
                  'Yes, Delete account',
                  'Cancel'
                );
              }}
              className="w-full p-4 flex items-center gap-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors"><Trash2 size={20} /></div>
              <div>
                <p className="font-bold text-[15px] text-red-500 group-hover:text-red-600">Delete Account</p>
              </div>
            </button>
          </div>
        </div>

        {showSupportDrawer && (
          <div className="fixed inset-0 z-[150] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSupportDrawer(false)} />
            <div className="relative bg-white dark:bg-zinc-900 w-full rounded-t-[2.5rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full mx-auto mb-8" />
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 text-center">Contact DROPOFF</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center mb-8 px-4 font-bold">Need help? Reach out to our team via any of these channels.</p>

              <div className="space-y-3">
                <a href="tel:+2203888888" className="w-full p-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-zinc-800 active:scale-95 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center"><Phone size={20} /></div>
                    <span className="font-black text-slate-900 dark:text-white">Call +220 3888888</span>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </a>

                <a 
                  href="whatsapp://send?phone=+2203888888&text=Hello%20Dropoff%20Support,%20I%20am%20a%20Partner%20and%20I%20need%20assistance..." 
                  target="_blank" 
                  className="w-full p-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-zinc-800 active:scale-95 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-500/10 text-green-500 flex items-center justify-center"><MessageCircle size={20} /></div>
                    <span className="font-black text-slate-900 dark:text-white">WhatsApp +220 3888888</span>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </a>


                <a href="mailto:dropoffgm@gmail.com" className="w-full p-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-zinc-800 active:scale-95 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-500 flex items-center justify-center"><Mail size={20} /></div>
                    <span className="font-black text-slate-900 dark:text-white">dropoffgm@gmail.com</span>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </a>


              </div>

              <button onClick={() => setShowSupportDrawer(false)} className="w-full mt-8 py-4 text-slate-400 font-black uppercase text-xs tracking-widest text-center">Close</button>
            </div>
          </div>
        )}
        {/* Developer Tools / Push Test */}
        <div className="mx-6 mt-4 mb-24 p-4 rounded-[24px] border border-dashed border-slate-300 dark:border-zinc-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Developer Tools</p>
          <button
            onClick={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                await sendPushNotification(
                  "Partner Test ⚡",
                  "If you see this, push notifications are working correctly for the Partner app!",
                  role.toLowerCase() as any,
                  session.user.id
                );
                showAlert('Test Notification', 'A test push request has been sent to your device.');
              }
            }}
            className="w-full py-4 rounded-2xl bg-[#00E39A]/10 text-[#00E39A] font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <MessageCircle size={18} /> Test Push Notification
          </button>
        </div>
      </div>
    </div>
  );
};
