
import React, { useState, useRef, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Store, Upload, X, MapPin, Navigation, Loader2, Plus, Clock, CheckCircle, Globe, Compass, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '../components/Input';
import { Dropdown } from '../components/Dropdown';
import { OnboardingStep } from './OnboardingScreen';
import { supabase } from '../lib/supabase';

interface OnboardingMerchantFlowProps {
  step: OnboardingStep;
  onNext: (data?: any) => void;
}

const DARK_MAP_STYLES = [{ elementType: "geometry", stylers: [{ color: "#242f3e" }] }, { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] }];
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const OnboardingMerchantFlow: React.FC<OnboardingMerchantFlowProps> = ({ step, onNext }) => {
  const { updateProfile, isDarkMode, uploadFile, profile, showAlert } = useApp();
  const { keyboardHeight } = useUI();
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [business, setBusiness] = useState({
    name: '',
    category: 'Restaurant',
    address: '',
    logo: '',
    locationSet: false,
    website: '',
    eWallet: 'Wave' as 'Wave' | 'Afrimoney' | 'Qmoney',
    subCategories: [] as string[],
    workingHours: { start: '09:00', end: '21:00' },
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    paymentPhone: ''
  });

  const [newSubCat, setNewSubCat] = useState('');
  const [merchantLocMode, setMerchantLocMode] = useState<'NONE' | 'OPTIONS' | 'MANUAL'>('NONE');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [categories, setCategories] = useState<{ label: string; value: string }[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapInstance = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase.from('business_categories').select('name').eq('is_active', true);
      if (data) {
        setCategories(data.map(cat => ({ label: cat.name, value: cat.name })));
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const google = (window as any).google;
    if (merchantLocMode === 'MANUAL' && mapRef.current && !googleMapInstance.current && google) {
      googleMapInstance.current = new google.maps.Map(mapRef.current, {
        center: { lat: 13.4432, lng: -16.6776 },
        zoom: 16,
        disableDefaultUI: true,
        styles: isDarkMode ? DARK_MAP_STYLES : []
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
  }, [merchantLocMode, isDarkMode]);

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    const google = (window as any).google;
    
    try {
      // Check and request permissions
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          showAlert("Permission Denied", "Location permission is required to find your store.");
          setIsLocating(false);
          return;
        }
      }

      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      if (position) {
        const { latitude, longitude } = position.coords;
        new google.maps.Geocoder().geocode({ location: { lat: latitude, lng: longitude } }, (results: any, status: any) => {
          if (status === "OK" && results[0]) {
            setBusiness(prev => ({ ...prev, locationSet: true, address: results[0].formatted_address, lat: latitude, lng: longitude }));
          } else {
            setBusiness(prev => ({ ...prev, locationSet: true, address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, lat: latitude, lng: longitude }));
          }
          setIsLocating(false);
          setMerchantLocMode('NONE');
        });
      }
    } catch (err) {
      console.error("GPS Error:", err);
      showAlert("GPS Error", "We couldn't find where you are. Please pick your location on the map.");
      setIsLocating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'idCard') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(type);
    const bucket = type === 'logo' ? 'avatars' : 'merchant_documents';
    const url = await uploadFile(file, bucket, `${Date.now()}_${file.name}`);

    if (url) {
      if (type === 'logo') setBusiness(prev => ({ ...prev, logo: url }));
      else updateProfile({ documents: { ...profile.documents, idCard: { url, status: 'PENDING' } } });
    }
    setIsUploading(null);
  };

  const addSubCategory = () => {
    if (newSubCat.trim() && business.subCategories.length < 6) {
      setBusiness(prev => ({ ...prev, subCategories: [...prev.subCategories, newSubCat.trim()] }));
      setNewSubCat('');
    }
  };

  const removeSubCategory = (index: number) => {
    setBusiness(prev => ({ ...prev, subCategories: prev.subCategories.filter((_, i) => i !== index) }));
  };

  const toggleDay = (day: string) => {
    const active = business.workingDays.includes(day);
    setBusiness(prev => ({
      ...prev,
      workingDays: active ? prev.workingDays.filter(d => d !== day) : [...prev.workingDays, day]
    }));
  };

  const handleConfirmLocation = () => {
    const google = (window as any).google;
    if (googleMapInstance.current && google) {
      setIsGeocoding(true);
      const center = googleMapInstance.current.getCenter();
      new google.maps.Geocoder().geocode({ location: { lat: center.lat(), lng: center.lng() } }, (results: any, status: any) => {
        if (status === "OK" && results[0]) {
          setBusiness(prev => ({ ...prev, locationSet: true, address: results[0].formatted_address, lat: center.lat(), lng: center.lng() }));
          setMerchantLocMode('NONE');
        }
        setIsGeocoding(false);
      });
    }
  };

  const [isCheckingName, setIsCheckingName] = useState(false);

  const handleNextWithData = async () => {
    // Rigid Validation
    const businessName = business.name.trim();
    if (!businessName) return showAlert("Missing Info", "Please enter your Business Name.");
    if (!business.category) return showAlert("Missing Info", "Please select a Business Category.");
    if (!business.address || !business.locationSet) return showAlert("Missing Info", "Please pin your store location on the map.");
    if (!business.paymentPhone.trim()) return showAlert("Missing Info", "Please enter your Wave/Payment phone number.");
    if (business.subCategories.length === 0) return showAlert("Missing Info", "Please add at least one Product Group or Tag (e.g. Pizza).");

    // Uniqueness Check
    setIsCheckingName(true);
    try {
      const { data: existing, error } = await supabase
        .from('businesses')
        .select('id')
        .ilike('name', businessName)
        .maybeSingle();

      if (existing) {
        showAlert("Name Taken", "A business with this name already exists. Please choose a unique name for your shop.");
        setIsCheckingName(false);
        return;
      }
    } catch (err) {
      console.error("Error checking business name:", err);
    } finally {
      setIsCheckingName(false);
    }

    updateProfile({
      location: business.address,
      business: {
        businessName: businessName,
        category: business.category,
        logo: business.logo,
        address: business.address,
        workingHours: business.workingHours,
        workingDays: business.workingDays,
        subCategories: business.subCategories,
        phone: business.paymentPhone,
        eWallet: business.eWallet,
        website: business.website,
        lat: business.lat,
        lng: business.lng,
        paymentPhone: business.paymentPhone
      }
    });
    onNext();
  };

  if (step === 'MERCHANT_FORM') {
    return (
      <div className="px-8 flex flex-col h-full bg-white dark:bg-black animate-in slide-in-from-right duration-500 overflow-hidden">
        <div className="shrink-0 pt-8">
          <h2 className="text-[34px] font-black dark:text-white mb-1.5 tracking-tight leading-tight">Business Details</h2>
          <p className="text-slate-500 text-lg mb-8 font-medium">Complete your store setup.</p>
        </div>

        <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar">
          {/* Logo Upload */}
          <div className="flex flex-col items-center">
            <div onClick={() => document.getElementById('b-logo-onb')?.click()} className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 dark:border-zinc-800 cursor-pointer text-slate-400 font-black text-2xl uppercase">
              {isUploading === 'logo' ? (
                <Loader2 className="animate-spin text-[#00E39A]" />
              ) : business.logo ? (
                <img src={business.logo} className="w-full h-full object-cover" />
              ) : business.name ? (
                <span>{(business.name.split(' ')[0][0] + (business.name.split(' ')[1]?.[0] || '')).toUpperCase()}</span>
              ) : (
                <Store className="text-slate-300" />
              )}
            </div>
            <input id="b-logo-onb" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
            <span className="text-[10px] font-black text-slate-400 uppercase mt-3 tracking-widest">Store Logo</span>
          </div>

          <Input label="Shop Name *" value={business.name} onChange={e => setBusiness({ ...business, name: e.target.value })} placeholder="Musa's Kitchen" />

          <div className="grid grid-cols-2 gap-4">
            <Dropdown label="Category *" value={business.category} options={categories} onChange={val => setBusiness({ ...business, category: val })} />
            <Dropdown label="Payout Method *" value={business.eWallet} options={[{ label: 'Wave', value: 'Wave' }, { label: 'Afrimoney', value: 'Afrimoney' }, { label: 'Qmoney', value: 'Qmoney' }]} onChange={val => setBusiness({ ...business, eWallet: val as any })} />
          </div>

          <Input
            label="Wave / Payment Number *"
            value={business.paymentPhone}
            onChange={e => setBusiness({ ...business, paymentPhone: e.target.value })}
            placeholder="e.g. 7123456"
            type="tel"
          />

          <Input label="Website (Optional)" value={business.website} onChange={e => setBusiness({ ...business, website: e.target.value })} placeholder="www.yourstore.gm" leftElement={<Globe size={18} className="text-slate-400 ml-4 mr-[-8px]" />} />

          {/* Subcategories */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase ml-2 block">Product Groups / Tags * (Min 1)</label>
            <div className="flex gap-2">
              <input
                value={newSubCat}
                onChange={e => setNewSubCat(e.target.value)}
                placeholder="e.g. Afra, Pizza, Sushi..."
                className="flex-1 bg-gray-100 dark:bg-[#1C1C1E] p-4 rounded-2xl font-medium text-lg text-gray-900 dark:text-white border border-transparent focus:ring-2 focus:ring-[#00E39A] outline-none transition-all placeholder-gray-400"
              />
              <button
                onClick={addSubCategory}
                disabled={business.subCategories.length >= 6 || !newSubCat.trim()}
                className="w-14 h-14 bg-slate-900 dark:bg-white text-white dark:text-black rounded-xl flex items-center justify-center disabled:opacity-30"
              >
                <Plus size={24} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {business.subCategories.length === 0 && <span className="text-[10px] text-red-400 font-bold uppercase ml-2">Add at least 1 group</span>}
              {business.subCategories.map((cat, idx) => (
                <div key={idx} className="bg-[#00E39A]/10 text-[#00E39A] px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 border border-[#00E39A]/20">
                  {cat} <button onClick={() => removeSubCategory(idx)}><X size={12} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Working Schedule */}
          <div className="bg-slate-50 dark:bg-zinc-900 p-5 rounded-[28px] border border-slate-100 dark:border-zinc-800 space-y-5">
            <div className="flex items-center gap-2 mb-1"><Clock size={18} className="text-[#00E39A]" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Hours</span></div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5"><label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">From</label><input type="time" value={business.workingHours.start} onChange={e => setBusiness({ ...business, workingHours: { ...business.workingHours, start: e.target.value } })} className="w-full bg-white dark:bg-zinc-800 p-3 rounded-xl font-bold dark:text-white border border-slate-100 dark:border-zinc-700" /></div>
              <div className="flex-1 space-y-1.5"><label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">To</label><input type="time" value={business.workingHours.end} onChange={e => setBusiness({ ...business, workingHours: { ...business.workingHours, end: e.target.value } })} className="w-full bg-white dark:bg-zinc-800 p-3 rounded-xl font-bold dark:text-white border border-slate-100 dark:border-zinc-700" /></div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Working Days</label>
              <div className="flex justify-between gap-1">
                {DAYS_OF_WEEK.map(day => {
                  const active = business.workingDays.includes(day);
                  return (
                    <button key={day} onClick={() => toggleDay(day)} className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${active ? 'bg-[#00E39A] text-slate-900 shadow-lg' : 'bg-white dark:bg-zinc-800 text-slate-400'}`}>{day.charAt(0)}</button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Location Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase ml-2 block tracking-wider">STORE LOCATION *</label>
            <button
              onClick={() => setMerchantLocMode('OPTIONS')}
              className={`w-full flex items-center justify-between p-5 rounded-[24px] bg-slate-50 dark:bg-zinc-900 border border-transparent hover:bg-slate-100 dark:hover:bg-zinc-850 transition-all ${business.locationSet ? 'ring-2 ring-green-500' : ''}`}
            >
              <div className="flex items-center gap-4">
                <MapPin className={business.locationSet ? 'text-green-500' : 'text-slate-400'} size={24} />
                <span className={`text-[17px] font-bold truncate max-w-[200px] ${business.locationSet ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                  {business.address || 'Pin location on map *'}
                </span>
              </div>
              <ChevronRight size={20} className="text-slate-300" />
            </button>
          </div>
        </div>

        <div className="shrink-0 pt-4 pb-6 transition-all duration-300" style={{ marginBottom: keyboardHeight > 0 ? `${keyboardHeight + 24}px` : '0px' }}>
          <button
            onClick={handleNextWithData}
            disabled={isUploading !== null || isCheckingName}
            className="w-full font-bold py-5 rounded-[22px] bg-slate-900 dark:bg-white text-white dark:text-black shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-300"
          >
            {isCheckingName && <Loader2 className="animate-spin" size={20} />}
            Complete Setup
          </button>
        </div>

        {/* Pin Store Options Overlay */}
        {merchantLocMode === 'OPTIONS' && (
          <div className="absolute inset-0 z-[110] bg-white dark:bg-black flex flex-col p-8 pt-20 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-[34px] font-black text-slate-900 dark:text-white tracking-tight">Pin Store</h3>
              <button onClick={() => setMerchantLocMode('NONE')} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 dark:bg-zinc-900 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 flex-1">
              <button
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="w-full bg-slate-50 dark:bg-zinc-900 p-6 rounded-[28px] border border-slate-100 dark:border-zinc-800 flex items-center gap-5 active:scale-95 transition-all text-left"
              >
                <div className="w-16 h-16 rounded-[22px] bg-green-50 dark:bg-green-900/10 text-green-500 flex items-center justify-center shrink-0">
                  {isLocating ? <Loader2 className="animate-spin" size={28} /> : <Compass size={32} />}
                </div>
                <div>
                  <h4 className="font-black text-xl text-slate-900 dark:text-white">Current GPS</h4>
                  <p className="text-slate-500 text-sm font-medium mt-0.5">Fast and accurate</p>
                </div>
              </button>

              <button
                onClick={() => setMerchantLocMode('MANUAL')}
                className="w-full bg-slate-50 dark:bg-zinc-900 p-6 rounded-[28px] border border-slate-100 dark:border-zinc-800 flex items-center gap-5 active:scale-95 transition-all text-left"
              >
                <div className="w-16 h-16 rounded-[22px] bg-blue-50 dark:bg-blue-900/10 text-blue-500 flex items-center justify-center shrink-0">
                  <MapPin size={32} />
                </div>
                <div>
                  <h4 className="font-black text-xl text-slate-900 dark:text-white">Drop on Map</h4>
                  <p className="text-slate-500 text-sm font-medium mt-0.5">Pick precisely</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Manual Map Selection */}
        {merchantLocMode === 'MANUAL' && (
          <div className="absolute inset-0 z-[120] bg-white dark:bg-black flex flex-col animate-in fade-in">
            <div className="absolute top-12 left-6 right-6 z-[130] flex gap-2">
              <button onClick={() => setMerchantLocMode('OPTIONS')} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl"><ChevronLeft size={24} /></button>
              <div className="flex-1 relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search address or Plus Code..."
                  className="w-full h-14 bg-white dark:bg-zinc-900 rounded-2xl px-12 font-bold shadow-xl focus:outline-none dark:text-white"
                />
                <Search className="absolute left-4 top-4 text-slate-400" size={20} />
              </div>
            </div>
            <div ref={mapRef} className="flex-1" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 animate-bounce pointer-events-none"><MapPin size={54} className="text-red-500 fill-red-500" /></div>
            <div className="p-8 bg-white dark:bg-zinc-900 rounded-t-[32px] shadow-2xl z-[140] border-t border-slate-100 dark:border-zinc-800">
              <h3 className="text-xl font-bold mb-4 dark:text-white">Pin Store Location</h3>
              <button onClick={handleConfirmLocation} disabled={isGeocoding} className="w-full bg-[#00E39A] text-slate-900 font-black py-5 rounded-[20px] flex items-center justify-center gap-2 active:scale-95 transition-all">
                {isGeocoding ? <Loader2 className="animate-spin" /> : 'Set Store Location'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-8 pb-10 h-full flex flex-col bg-white dark:bg-black pt-safe pb-safe animate-in slide-in-from-right duration-500">
      <div className="shrink-0 pt-8">
        <h2 className="text-[34px] font-black dark:text-white mb-1.5 tracking-tight leading-tight">Verification</h2>
        <p className="text-slate-500 text-lg mb-8 font-medium">Upload your National ID Card.</p>
      </div>

      <div
        onClick={() => document.getElementById('merch-id-onb')?.click()}
        className={`bg-slate-50 dark:bg-zinc-900 p-12 rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${profile.documents.idCard?.url ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-slate-200 dark:border-slate-800'}`}
      >
        {isUploading === 'idCard' ? <Loader2 className="animate-spin text-[#00E39A]" /> : profile.documents.idCard?.url ? <CheckCircle className="text-green-500" size={56} /> : <Upload size={56} className="text-slate-300" />}
        <div className="text-center">
          <span className="font-black uppercase tracking-widest text-[12px] block mb-1">{profile.documents.idCard?.url ? 'ID Uploaded' : 'Tap to Upload ID'}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Gambia National ID or Passport</span>
        </div>
        <input id="merch-id-onb" type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'idCard')} />
      </div>

      <div className="mt-8 p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
        <p className="text-blue-600 dark:text-blue-400 text-xs font-medium leading-relaxed">
          Your business profile will be reviewed by our team. You can start setting up your menu/inventory in the meantime.
        </p>
      </div>

      <div className="mt-auto space-y-3 shrink-0 pt-4 pb-10 transition-all duration-300" style={{ marginBottom: keyboardHeight > 0 ? `${keyboardHeight + 24}px` : '0px' }}>
        <button
          onClick={() => onNext({ business })}
          disabled={isUploading !== null}
          className="w-full bg-slate-900 dark:bg-white text-white dark:text-black font-black py-5 rounded-[22px] shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
        >
          Finish Setup
        </button>
        <button
          onClick={() => onNext({ business })}
          className="w-full bg-transparent text-slate-400 font-bold py-2 text-sm uppercase tracking-widest"
        >
          Skip for Now
        </button>
      </div>
    </div>
  );
};
