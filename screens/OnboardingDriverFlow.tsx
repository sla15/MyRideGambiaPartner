
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Upload, Camera, Car, User, Loader2, CheckCircle, Sparkles, Trash2 } from 'lucide-react';
import { Input } from '../components/Input';
import { Dropdown } from '../components/Dropdown';
import { OnboardingStep } from './OnboardingScreen';
import { UserProfile } from '../types';

interface OnboardingDriverFlowProps {
  step: OnboardingStep;
  onNext: (data?: any) => void;
}

export const OnboardingDriverFlow: React.FC<OnboardingDriverFlowProps> = ({ step, onNext }) => {
  const { updateProfile, uploadFile, profile } = useApp();
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const [vehicle, setVehicle] = useState<NonNullable<UserProfile['vehicle']>>({
    model: '', plate: '', color: '', type: 'ECONOMIC', seats: 4, hasAC: false, images: []
  });
  const [localLocation, setLocalLocation] = useState('');

  const typeOptions = [
    { label: 'Scooters & TukTuk', value: 'SCOOTER_TUKTUK' },
    { label: 'Economic (No AC)', value: 'ECONOMIC' },
    { label: 'Premium (With AC)', value: 'PREMIUM' }
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'license' | 'insurance' | 'idCard') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(type);
    const bucket = type === 'avatar' ? 'avatars' : 'documents';
    const fileName = `${Date.now()}_${file.name}`;
    const url = await uploadFile(file, bucket, fileName);

    if (url) {
      if (type === 'avatar') {
        updateProfile({ image: url });
      } else {
        updateProfile({
          documents: {
            ...profile.documents,
            [type]: { url, status: 'APPROVED' }
          }
        });
      }
    }
    setIsUploading(null);
  };

  const removeVehicleImage = (index: number) => {
    setVehicle(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleTypeChange = (type: string) => {
    const isPremium = type === 'PREMIUM';
    const isSmall = type === 'SCOOTER_TUKTUK';
    setVehicle({
      ...vehicle,
      type: type as any,
      hasAC: isPremium,
      seats: isSmall ? 2 : 4
    });
  };

  if (step === 'DRIVER_FORM') {
    return (
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-black animate-in slide-in-from-right duration-500 relative">
        <div className="px-8 pb-4 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
          <h2 className="text-[34px] font-black dark:text-white mb-1.5 tracking-tight leading-tight">Driver Profile</h2>
          <p className="text-slate-500 text-lg font-medium">Setup your vehicle and account.</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-8 pb-32">
          {/* Profile Photo */}
          <div className="flex flex-col items-center mb-6 mt-2">
            <div className="relative">
              <div
                onClick={() => document.getElementById('v-up')?.click()}
                className="w-32 h-32 rounded-[2.5rem] bg-slate-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 dark:border-zinc-800 cursor-pointer"
              >
                {isUploading === 'avatar' ? (
                  <Loader2 className="animate-spin text-[#00E39A]" size={32} />
                ) : profile.image ? (
                  <img src={profile.image} className="w-full h-full object-cover" />
                ) : profile.name ? (
                  <span className="text-3xl font-black text-slate-400 dark:text-slate-500 uppercase">
                    {(profile.name.split(' ')[0][0] + (profile.name.split(' ')[1]?.[0] || '')).toUpperCase()}
                  </span>
                ) : (
                  <User size={48} className="text-slate-300" />
                )}
              </div>
              <button className="absolute -bottom-2 -right-2 bg-[#00E39A] p-3 rounded-2xl shadow-lg border-4 border-white dark:border-black" onClick={() => document.getElementById('v-up')?.click()}><Camera size={18} /></button>
              <input id="v-up" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-widest">Profile Photo</span>
          </div>

          <div className="space-y-6">
            {/* Vehicle Category */}
            <Dropdown label="Vehicle Category" value={vehicle.type} options={typeOptions} onChange={handleTypeChange} />

            {vehicle.type === 'PREMIUM' && (
              <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-900/20 flex items-center gap-3 animate-in zoom-in duration-300">
                <div className="w-10 h-10 rounded-xl bg-green-500 text-white flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <p className="text-green-600 dark:text-green-400 font-bold text-sm">Premium Benefit</p>
                  <p className="text-green-500/80 text-[11px] font-medium leading-tight">Earn more money with air-conditioned rides!</p>
                </div>
              </div>
            )}


            <Input label="Vehicle Model *" value={vehicle.model} onChange={e => setVehicle({ ...vehicle, model: e.target.value })} placeholder="e.g. Toyota Corolla" />
            <Input label="Home Area *" value={localLocation} onChange={e => setLocalLocation(e.target.value)} placeholder="Brusubi" />

            <div className="flex gap-2">
              <Input label="Plate *" value={vehicle.plate} onChange={e => setVehicle({ ...vehicle, plate: e.target.value })} placeholder="BJL 123" containerClassName="w-[40%]" />
              <Input label="Color *" value={vehicle.color} onChange={e => setVehicle({ ...vehicle, color: e.target.value })} placeholder="Silver" containerClassName="w-[60%]" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-black via-white/80 dark:via-black/80 to-transparent transition-all duration-300">
          <button
            onClick={() => { updateProfile({ vehicle, location: localLocation }); onNext(); }}
            disabled={isUploading !== null || !vehicle.model.trim() || !vehicle.plate.trim() || !vehicle.color.trim() || !localLocation.trim()}
            className={`w-full font-black py-5 rounded-[22px] transition-all duration-300 shadow-xl ${isUploading !== null || !vehicle.model.trim() || !vehicle.plate.trim() || !vehicle.color.trim() || !localLocation.trim()
                ? 'bg-slate-100 dark:bg-zinc-900 text-slate-300 dark:text-zinc-600 cursor-not-allowed border border-slate-200 dark:border-zinc-800'
                : 'bg-slate-900 dark:bg-white text-white dark:text-black active:scale-95'
              }`}
          >
            Next Step
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black pt-safe pb-safe animate-in slide-in-from-right duration-500 relative">
      <div className="px-8 pb-4 shrink-0 pt-8">
        <h2 className="text-[34px] font-black dark:text-white mb-1.5 tracking-tight leading-tight">Verification</h2>
        <p className="text-slate-500 text-lg font-medium">Upload photos for verification.</p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-8 pb-32">
        <div className="space-y-4 pt-4">
          {[
            { id: 'idCard', label: 'National ID Card' },
            { id: 'license', label: 'Driver\'s License' },
            { id: 'insurance', label: 'Vehicle Insurance' }
          ].map((doc) => {
            const uploaded = profile.documents[doc.id as keyof typeof profile.documents]?.url;
            return (
              <div
                key={doc.id}
                className={`bg-slate-50 dark:bg-zinc-900 p-5 rounded-[22px] border-2 border-dashed flex items-center justify-between transition-all ${uploaded ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-slate-200 dark:border-slate-800'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${uploaded ? 'text-green-500' : 'text-slate-500'}`}>
                    {isUploading === doc.id ? <Loader2 className="animate-spin" /> : uploaded ? <CheckCircle /> : <Upload />}
                  </div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{doc.label}</span>
                </div>
                <input id={`file-${doc.id}`} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, doc.id as any)} />
                <button
                  onClick={() => document.getElementById(`file-${doc.id}`)?.click()}
                  className={`text-[10px] font-black tracking-widest uppercase ${uploaded ? 'text-green-500' : 'text-[#00E39A]'}`}
                >
                  {uploaded ? 'UPLOADED' : 'UPLOAD'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-black via-white/80 dark:via-black/80 to-transparent flex flex-col gap-3">
        <button
          onClick={() => onNext({ vehicle })}
          className="w-full bg-slate-900 dark:bg-white text-white dark:text-black font-black py-5 rounded-[22px] shadow-xl active:scale-95 transition-all"
        >
          Complete Setup
        </button>
        <button
          onClick={() => onNext({ vehicle })}
          className="w-full bg-transparent text-slate-400 font-bold py-2 text-sm uppercase tracking-widest"
        >
          Skip for Now
        </button>
      </div>
    </div>
  );
};
