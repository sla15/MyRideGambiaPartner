import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Car, Store, User, ChevronLeft, Loader2, Phone } from 'lucide-react';
import { Input } from '../components/Input';
import { Dropdown } from '../components/Dropdown';
import { OnboardingDriverFlow } from './OnboardingDriverFlow';
import { OnboardingMerchantFlow } from './OnboardingMerchantFlow';

import { supabase } from '../lib/supabase';

export type OnboardingStep = 'WELCOME' | 'PHONE_INPUT' | 'VERIFY' | 'INFO' | 'ROLE' | 'DRIVER_FORM' | 'DRIVER_DOCS' | 'MERCHANT_FORM' | 'MERCHANT_DOCS';

export const OnboardingScreen: React.FC = () => {
  const { updateProfile, completeOnboarding, setRole, secondaryOnboardingRole, cancelSecondaryOnboarding, profile, setCurrentTab, loadUserData } = useApp();
  const [stepIndex, setStepIndex] = useState(0);

  const [name, setName] = useState('');
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'DRIVER' | 'MERCHANT' | 'BOTH' | null>(null);

  const steps = ((): OnboardingStep[] => {
    if (secondaryOnboardingRole === 'DRIVER') return ['DRIVER_FORM', 'DRIVER_DOCS'];
    if (secondaryOnboardingRole === 'MERCHANT') return ['MERCHANT_FORM', 'MERCHANT_DOCS'];

    // Standard flow base
    const base: OnboardingStep[] = ['WELCOME', 'PHONE_INPUT', 'VERIFY'];

    // We dynamically add INFO if needed (handled in logic), but for steps array consistency:
    // This array is mainly for progress bar. We might jump over INFO.
    const remaining = ['INFO', 'ROLE'];

    if (selectedRole === 'DRIVER') return [...base, ...remaining, 'DRIVER_FORM', 'DRIVER_DOCS'];
    if (selectedRole === 'MERCHANT') return [...base, ...remaining, 'MERCHANT_FORM', 'MERCHANT_DOCS'];
    if (selectedRole === 'BOTH') return [...base, ...remaining, 'DRIVER_FORM', 'DRIVER_DOCS', 'MERCHANT_FORM', 'MERCHANT_DOCS'];
    return [...base, ...remaining];
  })();

  // Skip logic: if already logged in and just missing data, jump to correct step
  // But for the new flow, we generally start at the beginning unless it's a secondary onboarding
  useEffect(() => {
    if (secondaryOnboardingRole !== null) return;

    // If we somehow have phone but no name, we might be in the middle of this flow
    // But usually we trust the local state 'stepIndex'
  }, [secondaryOnboardingRole]);

  const currentStep = steps[stepIndex];

  // Progress calculation needs to handle the dynamic 'INFO' skip
  // Simple approximation for now
  const progressWidth = ((stepIndex + 1) / steps.length) * 100;
  const isDocStep = currentStep.endsWith('_DOCS');

  const handleNext = (flowData?: any) => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      finalizeOnboarding(flowData);
    }
  };

  const handleBack = () => {
    if (secondaryOnboardingRole !== null && stepIndex === 0) {
      cancelSecondaryOnboarding();
      return;
    }
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  const finalizeOnboarding = async (finalData?: any) => {
    await completeOnboarding();
    // Use the role to determine where to go next
    if (selectedRole === 'MERCHANT' || secondaryOnboardingRole === 'MERCHANT') {
      setCurrentTab('merchant');
    } else {
      setCurrentTab('home');
    }
  };

  const handleSendOtp = async () => {
    if (phone.length < 7) return;
    setIsVerifying(true);
    const fullPhone = `+220${phone.replace(/\s/g, '')}`;

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });
      if (error) throw error;
      setStepIndex(steps.indexOf('VERIFY'));
    } catch (err: any) {
      alert(`Error sending code: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) return;
    setIsVerifying(true);
    const fullPhone = `+220${phone.replace(/\s/g, '')}`;

    try {
      const { error, data } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: code,
        type: 'sms',
      });
      if (error) throw error;

      console.log("OTP Verified successfully", data);

      if (data.user) {
        // Check if profile already exists
        const { data: existingProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (existingProfile && existingProfile.full_name) {
          // User exists and has a name -> Dashboard
          // Check if they have a role to skip role selection too

          // Sync context with fetched profile
          await loadUserData(data.user.id); // Force refresh from DB

          if (existingProfile.role && existingProfile.role !== 'CUSTOMER') {
            // Fully onboarded
            await completeOnboarding();
            setIsVerifying(false);
            if (existingProfile.role === 'MERCHANT') {
              setCurrentTab('merchant');
            } else {
              setCurrentTab('home');
            }
            return;
          }

          // Has name but maybe no role (unlikely given previous logic, but possible)
          // Skip INFO (Name/Age), Go to ROLE
          setStepIndex(steps.indexOf('ROLE'));
        } else {
          // New user OR incomplete profile (no name)
          // Go to INFO (Name/Age)
          // We update the phone in profile context now that it's verified
          updateProfile({ phone: fullPhone });
          setStepIndex(steps.indexOf('INFO'));
        }
      } else {
        // Should not happen on successful verify
        setStepIndex(steps.indexOf('INFO'));
      }

      setIsVerifying(false);
    } catch (err: any) {
      console.error("OTP Verification failed", err);
      alert(`Invalid code: ${err.message}`);
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const renderWelcome = () => (
    <div className="flex flex-col h-full px-8 pb-12 bg-white dark:bg-black overflow-hidden relative">
      <style>{`
        @keyframes subtleFloat { 0% { transform: translateY(0px); } 50% { transform: translateY(-15px); } 100% { transform: translateY(0px); } }
        .animate-subtle-float { animation: subtleFloat 4s ease-in-out infinite; }
      `}</style>
      <div className="flex-1 flex flex-col justify-end pb-24">
        <div className="flex flex-col items-start relative">
          <div className="relative mb-12">
            <div className="w-24 h-24 bg-black dark:bg-white rounded-[2.5rem] flex items-center justify-center relative z-10 animate-subtle-float shadow-2xl">
              <div className="w-12 h-12 rounded-full border-[5px] border-[#00E39A] relative flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-[#00E39A]/30"></div>
              </div>
            </div>
          </div>
          <h1 className="text-[56px] font-black text-slate-900 dark:text-white leading-[0.95] tracking-tighter mb-4">Partner<br />App.</h1>
          <p className="text-slate-500 text-xl max-w-[280px] leading-relaxed font-medium">Partner with the network. Drive or Sell in The Gambia.</p>
        </div>
      </div>
      <div className="space-y-6 shrink-0">
        <button onClick={() => setStepIndex(steps.indexOf('PHONE_INPUT'))} className="w-full bg-[#00E39A] text-slate-900 font-black text-[20px] py-5 rounded-[24px] shadow-lg active:scale-[0.97] transition-all">Get Started</button>
      </div>
    </div>
  );

  const renderPhoneInput = () => {
    const canContinue = phone.length >= 7;
    return (
      <div className="px-8 pb-10 pt-20 h-full flex flex-col bg-white dark:bg-black overflow-hidden animate-in slide-in-from-right duration-500">
        <h2 className="text-[34px] font-black text-slate-900 dark:text-white mb-1 tracking-tight leading-tight">Enter your phone</h2>
        <p className="text-slate-500 text-[15px] mb-8 font-medium">We'll send you a code to verify it.</p>

        <div className="flex-1">
          <Input
            label="Phone Number"
            prefix="+220"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="*******"
            type="tel"
            maxLength={7}
            autoFocus
          />
        </div>

        <button onClick={handleSendOtp} disabled={!canContinue || isVerifying} className={`w-full font-black py-5 rounded-[22px] mt-8 transition-all text-lg flex items-center justify-center gap-2 ${canContinue && !isVerifying ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-xl active:scale-[0.98]' : 'bg-slate-100 text-slate-300'}`}>
          {isVerifying ? <Loader2 className="animate-spin" /> : null}
          {isVerifying ? 'Sending...' : 'Send Code'}
        </button>
      </div>
    )
  }

  const renderInfo = () => {
    const ageOptions = Array.from({ length: 68 }, (_, i) => ({ label: `${i + 18}`, value: `${i + 18}` }));
    const genderOptions = [{ label: 'Male', value: 'MALE' }, { label: 'Female', value: 'FEMALE' }, { label: 'Other', value: 'OTHER' }];
    const canContinue = name.trim().length >= 3;

    return (
      <div className="px-8 pb-10 pt-20 h-full flex flex-col bg-white dark:bg-black overflow-hidden animate-in slide-in-from-right duration-500">
        <h2 className="text-[34px] font-black text-slate-900 dark:text-white mb-1 tracking-tight leading-tight">Tell us about yourself</h2>
        <p className="text-slate-500 text-[15px] mb-8 font-medium">Your data is stored securely with your profile.</p>
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
          <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Musa Camara" />
          <div className="flex gap-4">
            <Dropdown label="Age" value={age} options={ageOptions} onChange={setAge} containerClassName="flex-1" searchable />
            <Dropdown label="Gender" value={gender} options={genderOptions} onChange={val => setGender(val as any)} containerClassName="flex-1" />
          </div>
        </div>
        <button onClick={() => {
          // Save profile details to DB immediately to avoid loss
          updateProfile({ name, age: parseInt(age), gender: gender });
          handleNext();
        }} disabled={!canContinue} className={`w-full font-black py-5 rounded-[22px] mt-8 transition-all text-lg flex items-center justify-center gap-2 ${canContinue ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-xl active:scale-[0.98]' : 'bg-slate-100 text-slate-300'}`}>
          Continue
        </button>
      </div>
    );
  };

  const renderVerify = () => (
    <div className="px-8 pb-10 pt-24 h-full flex flex-col bg-white dark:bg-black overflow-hidden animate-in slide-in-from-right duration-500">
      <h2 className="text-[34px] font-black text-slate-900 dark:text-white mb-1.5 tracking-tight leading-tight">Verification</h2>
      <p className="text-slate-500 text-lg mb-10 font-medium">Verify +220 {phone}</p>

      <div className="flex-1 flex flex-col items-center justify-center -mt-20">
        <div className="flex gap-2 mb-8">
          {otp.map((digit, idx) => (
            <input
              key={idx}
              id={`otp-${idx}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(idx, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
              className="w-12 h-16 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl text-center text-2xl font-black focus:border-[#00E39A] focus:outline-none transition-all dark:text-white"
            />
          ))}
        </div>
        <p className="text-slate-500 text-center max-w-[200px] mb-8 font-medium">Enter the 6-digit code sent to your phone.</p>
      </div>

      <button
        onClick={handleVerifyOtp}
        disabled={isVerifying || otp.join('').length < 6}
        className={`w-full font-black py-5 rounded-[22px] mt-auto transition-all text-lg flex items-center justify-center gap-3 ${otp.join('').length === 6 && !isVerifying
          ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-xl active:scale-[0.98]'
          : 'bg-slate-100 text-slate-300'
          }`}
      >
        {isVerifying && <Loader2 className="animate-spin" />}
        {isVerifying ? 'Verifying...' : 'Verify'}
      </button>
    </div>
  );

  const renderRoleSelection = () => (
    <div className="px-8 pb-10 pt-24 h-full flex flex-col bg-white dark:bg-black overflow-hidden animate-in slide-in-from-right duration-500">
      <h2 className="text-[34px] font-black text-slate-900 dark:text-white mb-1.5 tracking-tight leading-tight">Select your role</h2>
      <p className="text-slate-500 text-lg mb-10 font-medium">This determines your partner dashboard.</p>

      <div className="space-y-4 flex-1">
        <button onClick={() => { setSelectedRole('DRIVER'); setRole('DRIVER'); }} className={`w-full p-6 rounded-[28px] border-2 transition-all text-left flex items-center gap-5 ${selectedRole === 'DRIVER' ? 'bg-[#00E39A]/10 border-[#00E39A]' : 'bg-slate-50 dark:bg-zinc-900 border-transparent'}`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${selectedRole === 'DRIVER' ? 'bg-[#00E39A] text-slate-900' : 'bg-white dark:bg-black text-slate-400'}`}><Car size={28} /></div>
          <div><h4 className="font-black text-xl dark:text-white">Driver</h4><p className="text-slate-500 text-sm font-medium">Earn by giving rides</p></div>
        </button>

        <button onClick={() => { setSelectedRole('MERCHANT'); setRole('MERCHANT'); }} className={`w-full p-6 rounded-[28px] border-2 transition-all text-left flex items-center gap-5 ${selectedRole === 'MERCHANT' ? 'bg-[#00E39A]/10 border-[#00E39A]' : 'bg-slate-50 dark:bg-zinc-900 border-transparent'}`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${selectedRole === 'MERCHANT' ? 'bg-[#00E39A] text-slate-900' : 'bg-white dark:bg-black text-slate-400'}`}><Store size={28} /></div>
          <div><h4 className="font-black text-xl dark:text-white">Merchant</h4><p className="text-slate-500 text-sm font-medium">Sell food or goods</p></div>
        </button>

        <button onClick={() => { setSelectedRole('BOTH'); setRole('DRIVER'); }} className={`w-full p-6 rounded-[28px] border-2 transition-all text-left flex items-center gap-5 ${selectedRole === 'BOTH' ? 'bg-[#00E39A]/10 border-[#00E39A]' : 'bg-slate-50 dark:bg-zinc-900 border-transparent'}`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${selectedRole === 'BOTH' ? 'bg-[#00E39A] text-slate-900' : 'bg-white dark:bg-black text-slate-400'}`}><User size={28} /></div>
          <div><h4 className="font-black text-xl dark:text-white">Both</h4><p className="text-slate-500 text-sm font-medium">Maximize your earnings</p></div>
        </button>
      </div>

      <button onClick={() => handleNext()} disabled={!selectedRole} className={`w-full font-black py-5 rounded-[22px] mt-6 transition-all text-lg ${selectedRole ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-xl active:scale-[0.98]' : 'bg-slate-100 text-slate-300'}`}>Continue</button>
    </div>
  );

  return (
    <div className="h-full bg-white dark:bg-black relative overflow-hidden">
      {currentStep !== 'WELCOME' && (
        <div className="absolute top-10 left-0 right-0 z-20">
          <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-900 overflow-hidden">
            <div className="h-full bg-[#00E39A] transition-all duration-500" style={{ width: `${progressWidth}%` }}></div>
          </div>

          {currentStep !== 'INFO' && (
            <div className="px-6 py-4 flex items-center justify-between">
              {/* Only show back button if not in VERIFY step or if no OTP has been entered yet. 
                 Also, in PHONE_INPUT we can go back to WELCOME. 
              */}
              {(currentStep !== 'VERIFY' || otp.every(d => !d)) ? (
                <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">
                  <ChevronLeft size={24} className="text-slate-900 dark:text-white" />
                </button>
              ) : <div className="w-8 h-8" />}
              {isDocStep && (
                <button onClick={() => handleNext()} className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Skip</button>
              )}
            </div>
          )}
        </div>
      )}

      {currentStep === 'WELCOME' && renderWelcome()}
      {currentStep === 'PHONE_INPUT' && renderPhoneInput()}
      {currentStep === 'INFO' && renderInfo()}
      {currentStep === 'VERIFY' && renderVerify()}
      {currentStep === 'ROLE' && renderRoleSelection()}
      {(currentStep === 'DRIVER_FORM' || currentStep === 'DRIVER_DOCS') && (
        <OnboardingDriverFlow step={currentStep} onNext={handleNext} />
      )}
      {(currentStep === 'MERCHANT_FORM' || currentStep === 'MERCHANT_DOCS') && (
        <OnboardingMerchantFlow step={currentStep} onNext={handleNext} />
      )}
    </div>
  );
};
