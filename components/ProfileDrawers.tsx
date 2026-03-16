
import React, { useState, useRef, useEffect } from 'react';
import { X, Car, MapPin, Camera, Upload, Trash2, Wind, Sparkles, Loader2, ChevronRight, ShieldCheck, ArrowLeft, Search, ChevronLeft, Navigation, Wallet, Compass } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { Store, Globe, Plus, Clock } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const DrawerFrame: React.FC<DrawerProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 w-full rounded-t-[2.5rem] flex flex-col max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="w-full flex justify-center py-4" onClick={onClose}>
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full cursor-pointer" />
        </div>
        <div className="px-8 pb-4 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-400">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar px-8 pb-10">
          {children}
        </div>
      </div>
    </div>
  );
};


export const BusinessDetailsContent: React.FC<{ onClose: () => void, onActiveDrawerChange?: (drawer: 'VEHICLE' | 'LOCATION' | 'VERIFICATION' | 'BUSINESS' | 'BUSINESS_MAP' | null) => void }> = ({ onClose, onActiveDrawerChange }) => {
  const { profile, updateProfile, uploadFile, syncProfile, pushNotification } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [localBusiness, setLocalBusiness] = useState(profile.business || {

    businessName: '', category: 'Restaurant', eWallet: 'Wave' as any, address: '', logo: '', website: '', subCategories: [], workingHours: { start: '09:00', end: '21:00' }, workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], phone: '', lat: undefined, lng: undefined, paymentPhone: ''
  });
  const [categories, setCategories] = useState<{ label: string; value: string }[]>([]);
  const [newSubCat, setNewSubCat] = useState('');
  const walletOptions = [{ label: 'Wave', value: 'Wave' }, { label: 'Afrimoney', value: 'Afrimoney' }, { label: 'Qmoney', value: 'Qmoney' }];
  const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  React.useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from('business_categories').select('name').eq('is_active', true);
      if (data) setCategories(data.map(c => ({ label: c.name, value: c.name })));
    };
    fetchCategories();
  }, []);

  const addSubCategory = () => {
    if (newSubCat.trim() && localBusiness.subCategories.length < 8) {
      setLocalBusiness(prev => ({ ...prev, subCategories: [...prev.subCategories, newSubCat.trim()] }));
      setNewSubCat('');
    }
  };

  const removeSubCategory = (index: number) => {
    setLocalBusiness(prev => ({ ...prev, subCategories: prev.subCategories.filter((_, i) => i !== index) }));
  };

  const toggleDay = (day: string) => {
    const active = localBusiness.workingDays.includes(day);
    if (active) setLocalBusiness(prev => ({ ...prev, workingDays: prev.workingDays.filter(d => d !== day) }));
    else setLocalBusiness(prev => ({ ...prev, workingDays: [...prev.workingDays, day] }));
  };

  const handleOpenMap = () => {
    // Save current progress before switching to map
    updateProfile({ business: localBusiness });
    if (onActiveDrawerChange) onActiveDrawerChange('BUSINESS_MAP');
  };

  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-col items-center">
        <div className="relative" onClick={() => document.getElementById('b-logo-drawer')?.click()}>
          <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-zinc-850 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-zinc-800 cursor-pointer">
            {localBusiness.logo ? <img src={localBusiness.logo} className="w-full h-full object-cover" /> : <Store size={32} className="text-slate-300" />}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-slate-900 dark:bg-white p-2 rounded-xl text-white dark:text-black shadow-lg"><Upload size={14} /></div>
          <input id="b-logo-drawer" type="file" className="hidden" accept="image/*" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              const url = await uploadFile(file, 'avatars', `${Date.now()}_${file.name}`);
              if (url) {
                setLocalBusiness(prev => ({ ...prev, logo: url }));
                updateProfile({ image: url });
              }
            }
          }} />
        </div>
        <span className="text-[10px] font-black text-slate-400 uppercase mt-3 tracking-widest">Store Logo</span>
      </div>

      <Input label="Shop Name" value={localBusiness.businessName} onChange={e => setLocalBusiness({ ...localBusiness, businessName: e.target.value })} />
      <div className="grid grid-cols-2 gap-4">
        <Dropdown label="Category" value={localBusiness.category} options={categories} onChange={val => setLocalBusiness({ ...localBusiness, category: val })} />
        <Dropdown label="Payout Wallet" value={localBusiness.eWallet} options={walletOptions} onChange={val => setLocalBusiness({ ...localBusiness, eWallet: val })} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Wave Number" value={localBusiness.paymentPhone || ''} onChange={e => setLocalBusiness({ ...localBusiness, paymentPhone: e.target.value })} placeholder="7xxxxxx" type="tel" />
        <Input label="Website" value={localBusiness.website} onChange={e => setLocalBusiness({ ...localBusiness, website: e.target.value })} placeholder="www.yoursite.gm" leftElement={<Globe size={18} className="text-slate-400 ml-4 mr-[-8px]" />} />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block tracking-wider">Sub-Categories</label>
        <div className="flex gap-2">
          <input value={newSubCat} onChange={e => setNewSubCat(e.target.value)} className="flex-1 bg-gray-100 dark:bg-[#1C1C1E] p-4 rounded-2xl font-medium text-lg text-gray-900 dark:text-white border border-transparent focus:ring-2 focus:ring-[#00E39A] outline-none transition-all placeholder-gray-400" placeholder="Add tag..." />
          <button onClick={addSubCategory} className="w-14 h-14 bg-black dark:bg-white text-white dark:text-black rounded-xl flex items-center justify-center"><Plus /></button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {localBusiness.subCategories.map((c, i) => (
            <div key={i} className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-full text-xs font-bold flex items-center gap-2">
              {c} <X size={12} className="cursor-pointer" onClick={() => removeSubCategory(i)} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block tracking-wider">STORE LOCATION</label>
        <button onClick={handleOpenMap} className="w-full flex items-center justify-between p-5 bg-slate-100 dark:bg-zinc-900 rounded-[24px] border border-transparent shadow-sm text-left active:scale-[0.98] transition-all">
          <div className="flex items-center gap-4">
            <MapPin className={localBusiness.address ? 'text-green-500' : 'text-slate-400'} size={24} />
            <span className={`text-[17px] font-bold truncate max-w-[200px] ${localBusiness.address ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
              {localBusiness.address || 'Pin location on map'}
            </span>
          </div>
          <ChevronRight size={20} className="text-slate-300" />
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-5 rounded-[28px] border border-slate-100 dark:border-zinc-800 space-y-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1"><Clock size={18} className="text-[#00E39A]" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational Schedule</span></div>
        <div className="flex gap-4">
          <div className="flex-1 space-y-1.5"><label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Opens</label><input type="time" value={localBusiness.workingHours.start} onChange={e => setLocalBusiness({ ...localBusiness, workingHours: { ...localBusiness.workingHours, start: e.target.value } })} className="w-full bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl font-bold dark:text-white border border-slate-100 dark:border-zinc-700" /></div>
          <div className="flex-1 space-y-1.5"><label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Closes</label><input type="time" value={localBusiness.workingHours.end} onChange={e => setLocalBusiness({ ...localBusiness, workingHours: { ...localBusiness.workingHours, end: e.target.value } })} className="w-full bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl font-bold dark:text-white border border-slate-100 dark:border-zinc-700" /></div>
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Active Days</label>
          <div className="flex justify-between gap-1">
            {DAYS_OF_WEEK.map(day => {
              const active = localBusiness.workingDays.includes(day);
              return (
                <button key={day} onClick={() => toggleDay(day)} className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${active ? 'bg-[#00E39A] text-slate-900 shadow-lg' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400'}`}>{day.charAt(0)}</button>
              );
            })}
          </div>
        </div>
      </div>

      <button 
        onClick={async () => {
          setIsSaving(true);
          try {
            const updated = { ...profile, business: localBusiness };
            updateProfile({ business: localBusiness });
            await syncProfile(updated);
            pushNotification('Success', 'Store details updated', 'SYSTEM');
            setIsSaving(false);
            onClose();
          } catch (err) {
            console.error("Store update error:", err);
            setIsSaving(false);
          }
        }} 
        disabled={isSaving}
        className="w-full bg-[#00E39A] text-slate-900 font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
      >
        {isSaving ? <Loader2 className="animate-spin" size={24} /> : 'Update Store'}
      </button>

    </div>
  );
};



const BusinessMapContent: React.FC<{ onActiveDrawerChange?: (drawer: any) => void }> = ({ onActiveDrawerChange }) => {
  const { profile, updateProfile, isDarkMode } = useApp();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapInstance = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const DARK_MAP_STYLES = [{ elementType: "geometry", stylers: [{ color: "#242f3e" }] }, { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] }];

  useEffect(() => {
    const google = (window as any).google;
    if (mapContainerRef.current && !googleMapInstance.current && google) {
      googleMapInstance.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 13.4432, lng: -16.6776 }, zoom: 16, disableDefaultUI: true, styles: isDarkMode ? DARK_MAP_STYLES : []
      });

      if (searchInputRef.current) {
        autocompleteRef.current = new google.maps.places.Autocomplete(searchInputRef.current);
        autocompleteRef.current.bindTo('bounds', googleMapInstance.current);
        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current.getPlace();
          if (!place.geometry || !place.geometry.location) return;
          googleMapInstance.current.setCenter(place.geometry.location);
          googleMapInstance.current.setZoom(17);
        });
      }
    }
  }, [isDarkMode]);

  const handleConfirmLocation = () => {
    const google = (window as any).google;
    if (googleMapInstance.current && google) {
      setIsGeocoding(true);
      const center = googleMapInstance.current.getCenter();
      new google.maps.Geocoder().geocode({ location: { lat: center.lat(), lng: center.lng() } }, (results: any, status: any) => {
        if (status === "OK" && results[0]) {
          updateProfile({ business: { ...profile.business, address: results[0].formatted_address, lat: center.lat(), lng: center.lng() } as any });
        }
        setIsGeocoding(false);
        if (onActiveDrawerChange) onActiveDrawerChange('BUSINESS');
      });
    }
  };

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="relative mb-4">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search address..."
          className="w-full h-14 bg-slate-50 dark:bg-zinc-800 rounded-2xl px-12 font-bold focus:outline-none dark:text-white border border-slate-200 dark:border-zinc-700"
        />
        <Search className="absolute left-4 top-4 text-slate-400" size={20} />
      </div>
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-slate-200 dark:border-zinc-800">
        <div ref={mapContainerRef} className="w-full h-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+18px)] z-10 animate-bounce pointer-events-none drop-shadow-2xl"><MapPin size={40} className="text-red-500 fill-red-500" /></div>
      </div>
      <button onClick={handleConfirmLocation} disabled={isGeocoding} className="w-full bg-[#00E39A] text-slate-900 font-black py-5 rounded-[20px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg mt-4 disabled:opacity-50">
        {isGeocoding ? <Loader2 className="animate-spin" size={24} /> : 'Set Store Location'}
      </button>
    </div>
  );
};

// 1. Vehicle Details Content
const VehicleDetailsContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { profile, updateProfile, uploadFile, completeOnboarding, syncProfile, pushNotification } = useApp();
  const [localVehicle, setLocalVehicle] = useState(profile.vehicle || {
    model: '', plate: '', color: '', type: 'ECONOMIC', seats: 4, hasAC: false, images: [] as string[]
  });
  const [isSaving, setIsSaving] = useState(false);


  const removePhoto = (idx: number) => {
    setLocalVehicle(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  const handleTypeChange = (type: string) => {
    const isPremium = type === 'PREMIUM';
    const isSmall = type === 'SCOOTER_TUKTUK';
    setLocalVehicle({
      ...localVehicle,
      type: type as any,
      hasAC: isPremium,
      seats: isSmall ? 2 : 4
    });
  };

  const typeOptions = [
    { label: 'Scooters & TukTuk', value: 'SCOOTER_TUKTUK' },
    { label: 'Economic (No AC)', value: 'ECONOMIC' },
    { label: 'Premium (With AC)', value: 'PREMIUM' }
  ];

  return (
    <div className="space-y-6 pt-2">

      <Dropdown label="Vehicle Category" value={localVehicle.type} options={typeOptions} onChange={handleTypeChange} />

      {localVehicle.type === 'PREMIUM' && (
        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-900/20 flex items-center gap-3 animate-in zoom-in duration-300">
          <Sparkles className="text-green-500" size={20} />
          <p className="text-green-600 dark:text-green-400 text-xs font-bold uppercase tracking-tight">Earn more money with AC enabled!</p>
        </div>
      )}

      <Input label="Vehicle Model" value={localVehicle.model} onChange={e => setLocalVehicle({ ...localVehicle, model: e.target.value })} placeholder="e.g. Toyota Camry" />

      <div className="flex gap-2">
        <Input label="Plate" value={localVehicle.plate} onChange={e => setLocalVehicle({ ...localVehicle, plate: e.target.value })} containerClassName="w-[40%]" placeholder="BJL 001" />
        <Input label="Color" value={localVehicle.color} onChange={e => setLocalVehicle({ ...localVehicle, color: e.target.value })} containerClassName="w-[60%]" placeholder="Silver" />
      </div>

      <button onClick={async () => {
        setIsSaving(true);
        try {
          const updated = { ...profile, vehicle: localVehicle as any };
          updateProfile({ vehicle: localVehicle as any });
          await syncProfile(updated);
          await completeOnboarding(updated);
          pushNotification('Success', 'Vehicle updated', 'SYSTEM');
          setIsSaving(false);
          onClose();
        } catch (err) {
          console.error("Vehicle update error:", err);
          setIsSaving(false);
        }
      }} disabled={isSaving} className="w-full bg-[#00E39A] text-slate-900 font-black py-5 rounded-2xl shadow-xl mt-4 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:scale-100">
        {isSaving ? <Loader2 className="animate-spin" size={24} /> : 'Save Changes'}
      </button>

    </div>
  );
};

// 2. Location Content
const LocationContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { profile, updateProfile, completeOnboarding, syncProfile, pushNotification } = useApp();
  const [loc, setLoc] = useState(profile.location || '');
  return (
    <div className="space-y-6 pt-2">
      <Input label="Home Area" value={loc} onChange={e => setLoc(e.target.value)} placeholder="e.g. Brusubi Phase 2" />
      <button className="w-full bg-slate-100 dark:bg-zinc-800 p-5 rounded-2xl flex items-center gap-4 text-slate-900 dark:text-white font-bold active:scale-95 transition-all">
        <MapPin size={24} className="text-[#00E39A]" />
        <span>Use Map to Pin Location</span>
      </button>
      <button onClick={async () => {
        const updated = { ...profile, location: loc };
        updateProfile({ location: loc });
        await syncProfile(updated);
        pushNotification('Success', 'Home area updated', 'SYSTEM');
        setTimeout(completeOnboarding, 50);
        onClose();
      }} className="w-full bg-slate-900 dark:bg-white text-white dark:text-black font-black py-5 rounded-2xl mt-4 shadow-xl active:scale-95">Update Location</button>
    </div>
  );
};

// 3. Verification Content
const VerificationContent: React.FC = () => {
  const { profile, role } = useApp();
  const allDocs = [
    { id: 'idCard', label: 'National ID Card', status: (profile.documents as any).idCard, roles: ['DRIVER', 'MERCHANT'] },
    { id: 'license', label: 'Driver\'s License', status: (profile.documents as any).license, roles: ['DRIVER'] },
    { id: 'insurance', label: 'Vehicle Insurance', status: (profile.documents as any).insurance, roles: ['DRIVER'] }
  ];

  const docs = allDocs.filter(d => d.roles.includes(role as any));

  return (
    <div className="space-y-4 pt-2">
      {docs.map(doc => (
        <div key={doc.id} className="bg-slate-50 dark:bg-zinc-850 p-5 rounded-[24px] flex items-center justify-between border border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-slate-400"><Upload size={20} /></div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm">{doc.label}</p>
              <p className={`text-[10px] font-black uppercase mt-1 ${doc.status?.status === 'VERIFIED' ? 'text-green-500' : 'text-orange-500'}`}>{doc.status?.status || 'MISSING'}</p>
            </div>
          </div>
          <button className="text-[#00E39A] font-black text-[10px] uppercase tracking-widest px-4 py-2 bg-[#00E39A]/10 rounded-lg active:scale-95 transition-all">Update</button>
        </div>
      ))}
    </div>
  );
};

export const ProfileDrawers: React.FC<{ activeDrawer: 'VEHICLE' | 'LOCATION' | 'VERIFICATION' | 'BUSINESS' | 'BUSINESS_MAP' | null, onClose: () => void, onActiveDrawerChange?: (drawer: 'VEHICLE' | 'LOCATION' | 'VERIFICATION' | 'BUSINESS' | 'BUSINESS_MAP' | null) => void }> = ({ activeDrawer, onClose, onActiveDrawerChange }) => {
  return (
    <>
      <DrawerFrame isOpen={activeDrawer === 'VEHICLE'} onClose={onClose} title="Vehicle Details">
        <VehicleDetailsContent onClose={onClose} />
      </DrawerFrame>
      <DrawerFrame isOpen={activeDrawer === 'LOCATION'} onClose={onClose} title="Location Settings">
        <LocationContent onClose={onClose} />
      </DrawerFrame>
      <DrawerFrame isOpen={activeDrawer === 'VERIFICATION'} onClose={onClose} title="Verification Center">
        <VerificationContent />
      </DrawerFrame>
      <DrawerFrame isOpen={activeDrawer === 'BUSINESS'} onClose={onClose} title="Store Details">
        <BusinessDetailsContent onClose={onClose} onActiveDrawerChange={onActiveDrawerChange} />
      </DrawerFrame>
      <DrawerFrame isOpen={activeDrawer === 'BUSINESS_MAP'} onClose={() => onActiveDrawerChange ? onActiveDrawerChange('BUSINESS') : onClose()} title="Pin Location">
        <BusinessMapContent onActiveDrawerChange={onActiveDrawerChange} />
      </DrawerFrame>
    </>
  );
};
