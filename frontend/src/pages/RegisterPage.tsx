// RegisterPage.jsx
import { useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import LanguageToggle from '../components/LanguageToggle';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

interface FormValues {
  phone_number: string;
  name: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
  city: string;
  state: string;
  postal_code: string;
  date_of_birth: string;
  tamil_star: string;
  gothra: string;
  gender: string;
  family_name: string;
  family_selection: string;
  password: string;
  confirm_password: string;
  otp_code: string;
}

const navLinks = [
  { label: 'Home', href: '#top' },
  { label: 'Darshan & Pooja', href: '#darshan' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Visit', href: '#visit' },
  { label: 'Events', href: '#top' },
  { label: 'Projects', href: '#top' },
  { label: 'About', href: '#top' },
] as const;

const benefits = [
  { icon: '📱', title: 'Mobile Access', description: 'Access all services from your mobile device' },
  { icon: '📅', title: 'Easy Booking', description: 'Book darshan and sevas with just a few taps' },
  { icon: '👨‍👩‍👧‍👦', title: 'Family Profiles', description: 'Manage multiple family members under one account' },
] as const;

const nakshatraOptions: string[] = [
  'aswini',
  'bharani',
  'karthigai',
  'rohini',
  'mrigsheersham',
  'tiruvadarai',
  'punarpoosam',
  'poosam',
  'aayilyam',
  'magam',
  'pooram',
  'uttiram',
  'chitrai',
  'swathi',
  'visakam',
  'anusham',
  'kettai',
  'moolam',
  'pooradam',
  'uttiradam',
  'thirivonam',
  'avittam',
  'sadayam',
  'poorattathi',
  'uttrattathi',
  'revathi',
] as const;

const RegisterPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [otpStatus, setOtpStatus] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [isStarDropdownOpen, setIsStarDropdownOpen] = useState(false);
  const [starSearch, setStarSearch] = useState('');
  const starInputRef = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    watch,
    trigger,
    setError,
  } = useForm<FormValues>({
    defaultValues: {
      phone_number: '',
      name: '',
      address_line1: '',
      address_line2: '',
      address_line3: '',
      city: '',
      state: '',
      postal_code: '',
      date_of_birth: '',
      tamil_star: '',
      gothra: '',
      gender: '',
      family_name: '',
      family_selection: '',
      password: '',
      confirm_password: '',
      otp_code: '',
    },
  });

  const familySelection = watch('family_selection');
  const fieldStepMap: Record<keyof FormValues, number> = {
    phone_number: 1,
    name: 1,
    password: 1,
    confirm_password: 1,
    otp_code: 1,
    address_line1: 2,
    address_line2: 2,
    address_line3: 2,
    city: 2,
    state: 2,
    postal_code: 2,
    date_of_birth: 3,
    tamil_star: 3,
    gothra: 3,
    gender: 3,
    family_selection: 3,
    family_name: 3,
  };

  const requestOtp = async () => {
    const phone = watch('phone_number');
    if (!phone) {
      setOtpStatus('Please enter your mobile number first.');
      return;
    }
    try {
      const { data } = await api.post('/auth/request-otp/', {
        phone_number: phone,
        purpose: 'registration',
      });
      setOtpStatus(`OTP sent! (Dev preview: ${data.code})`);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? 'Could not send OTP';
      setOtpStatus(detail);
    }
  };

  const nextStep = async () => {
    let isValid = false;
    
    if (currentStep === 1) {
      isValid = await trigger(['phone_number', 'name', 'otp_code', 'password', 'confirm_password']);
    } else if (currentStep === 2) {
      isValid = await trigger(['address_line1', 'address_line2', 'address_line3', 'city', 'state', 'postal_code']);
    } else if (currentStep === 3) {
      isValid = await trigger(['date_of_birth', 'tamil_star', 'gothra', 'gender', 'family_selection']);
      if (familySelection === 'other') {
        isValid = isValid && await trigger(['family_name']);
      }
    }
    
    if (isValid) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (values: FormValues) => {
    setApiError(null);
    const {
      family_selection,
      family_name: familyNameInput,
      gender,
      ...rest
    } = values;
    const payload: Record<string, unknown> = {
      ...rest,
      family_name:
        family_selection === 'other' ? familyNameInput : family_selection,
    };

    if (!values.date_of_birth) delete payload.date_of_birth;
    if (!payload.family_name) delete payload.family_name;
    if (gender) {
      payload.gender = gender;
    }

    try {
      const { data } = await api.post('/auth/register/', payload);
      setAuth({ user: data.user, tokens: data.tokens });
      navigate('/dashboard');
    } catch (error: any) {
      const responseData = error?.response?.data;

      if (typeof responseData === 'string') {
        setApiError(responseData);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
        const generalMessages: string[] = [];
        const fieldMessages: string[] = [];
        let earliestStep: number | null = null;

        if (typeof responseData.detail === 'string') {
          generalMessages.push(responseData.detail);
        }

        Object.entries(responseData).forEach(([key, value]) => {
          if (key === 'detail') {
            return;
          }
          const messages = Array.isArray(value) ? value : [value];
          if (key in fieldStepMap) {
            const fieldKey = key as keyof FormValues;
            setError(fieldKey, {
              type: 'server',
              message: messages.join(' '),
            });
            const step = fieldStepMap[fieldKey];
            earliestStep = earliestStep === null ? step : Math.min(earliestStep, step);
            fieldMessages.push(messages.join(' '));
          } else {
            generalMessages.push(messages.join(' '));
          }
        });

        if (earliestStep !== null && earliestStep !== currentStep) {
          setCurrentStep(earliestStep);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        const message =
          generalMessages[0] ??
          fieldMessages[0] ??
          'Please review the highlighted fields and try again.';
        setApiError(message);
        return;
      }

      const fallbackMessage = error?.message ?? 'Registration failed';
      setApiError(typeof fallbackMessage === 'string' ? fallbackMessage : 'Registration failed');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navBtn =
    'inline-flex h-10 items-center justify-center rounded-full px-5 whitespace-nowrap leading-none text-white transition-all duration-300 shadow-sm hover:shadow-lg transform hover:-translate-y-0.5';

  const steps = [
    { id: 1, title: 'Basic Information', description: 'Contact, Verification & Password' },
    { id: 2, title: 'Residential Details', description: 'Your Address Information' },
    { id: 3, title: 'Spiritual Details', description: 'Personal & Family Information' },
  ];

  const handleFocus = (fieldName: string) => {
    setIsFocused(fieldName);
  };

  const handleBlur = () => {
    setIsFocused(null);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(rgba(9,2,3,0.94), rgba(9,2,3,0.95)), url("https://images.unsplash.com/photo-1516796181074-a67c24fd651c?auto=format&fit=crop&w=1800&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Animated Background Elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-10 h-64 w-64 rounded-full bg-[#f3c85c]/20 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-4rem] right-[-4rem] h-96 w-96 rounded-full bg-[#f06f4a]/15 blur-3xl animate-pulse" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,209,112,0.2),transparent_55%)]" />
        
        {/* Floating Elements */}
        <div className="absolute top-1/4 left-1/4 w-8 h-8 rounded-full bg-amber-400/30 animate-float1" />
        <div className="absolute top-1/3 right-1/4 w-6 h-6 rounded-full bg-rose-400/30 animate-float2" />
        <div className="absolute bottom-1/4 left-1/3 w-10 h-10 rounded-full bg-yellow-400/30 animate-float3" />
        <div className="absolute bottom-1/3 right-1/3 w-5 h-5 rounded-full bg-orange-400/30 animate-float4" />
        
        {/* Temple Silhouette */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-amber-900/30 to-transparent opacity-50"></div>
      </div>

      {/* HEADER */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="bg-transparent text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
            <Link
              to="/"
              className="flex min-w-0 flex-col gap-1 text-left shrink-0 group"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-200 group-hover:text-amber-100 transition-colors">
                Kakkazhany Gramam
              </p>
              <p className="text-xs text-white/80 group-hover:text-white transition-colors">
                The Architectural Marvel of Agraharam
              </p>
            </Link>

            <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-white">
              {navLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-white transition-all duration-300 hover:text-[#f4ba1a] hover:scale-105"
                >
                  {item.label}
                </a>
              ))}
              <LanguageToggle />

              <div className="flex items-center gap-3">
                <Link to="/login" className={`${navBtn} bg-[#f06f4a] hover:bg-[#ff8a60]`}>
                  Login
                </Link>
                <Link
                  to="/register"
                  className={`${navBtn} bg-[#f06f4a] hover:bg-[#ff8a60]`}
                >
                  Sign&nbsp;Up
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 pb-14 pt-36">
        <div className="w-full max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Content */}
            <div className="space-y-8 animate-fade-in">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#f4c956] backdrop-blur-sm">
                  Join Our Community
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                  Create Your <span className="text-amber-300">Sacred Profile</span>
                </h1>
                <p className="text-lg md:text-xl text-amber-100 leading-relaxed">
                  Join our community to access temple services and receive personalized spiritual updates.
                </p>
              </div>

              {/* Benefits */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-amber-200">Membership Benefits</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 transition-all duration-300 hover:bg-white/20">
                      <div className="text-2xl mb-2">{benefit.icon}</div>
                      <h4 className="font-semibold text-white">{benefit.title}</h4>
                      <p className="text-xs text-amber-100/80 mt-1">{benefit.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Steps Visualization */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-amber-200">Registration Process</h3>
                <div className="space-y-3">
                  {steps.map((step) => (
                    <div 
                      key={step.id} 
                      className={`flex items-start gap-3 ${currentStep >= step.id ? 'opacity-100' : 'opacity-60'}`}
                    >
                      <div className={`mt-1 flex-shrink-0 rounded-full w-6 h-6 flex items-center justify-center ${
                        currentStep >= step.id 
                          ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-white' 
                          : 'bg-white/20 text-white/70'
                      }`}>
                        {step.id}
                      </div>
                      <div>
                        <div className={`font-medium ${currentStep >= step.id ? 'text-amber-300' : 'text-white/70'}`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-white/60">
                          {step.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-6 pt-4">
                <div className="flex items-center">
                  <span className="text-amber-300 font-bold text-xl mr-2">70K+</span>
                  <span className="text-xs font-medium text-[#f4c956] uppercase tracking-wider">
                    Annual Devotees
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-amber-300 font-bold text-xl mr-2">120+</span>
                  <span className="text-xs font-medium text-[#f4c956] uppercase tracking-wider">
                    Daily Sevas
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-amber-300 font-bold text-xl mr-2">24/7</span>
                  <span className="text-xs font-medium text-[#f4c956] uppercase tracking-wider">
                    Support
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="animate-fade-in-up">
              {/* Progress Steps */}
              <div className="mb-8">
                <div className="flex justify-between mb-6">
                  {steps.map((step) => (
                    <div key={step.id} className="flex flex-col items-center w-1/3 relative">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mb-3 transition-all duration-500 ${
                          currentStep >= step.id
                            ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-lg transform scale-110'
                            : 'bg-white/20 text-white/70'
                        }`}
                      >
                        {step.id}
                      </div>
                      <div className="text-center">
                        <div className={`text-base font-semibold ${currentStep >= step.id ? 'text-amber-300' : 'text-white/70'}`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-white/60 mt-1 max-w-[120px]">
                          {step.description}
                        </div>
                      </div>
                      
                      {/* Connector Line */}
                      {step.id < steps.length && (
                        <div className="absolute top-6 left-3/4 w-1/2 h-0.5 bg-white/20">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                            style={{ width: currentStep > step.id ? '100%' : '0%' }}
                          ></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-1 shadow-2xl">
                <div className="bg-white rounded-3xl overflow-hidden shadow-xl">
                  <form onSubmit={handleSubmit(onSubmit)} className="p-8">
                    {apiError && (
                      <div className="mb-6 p-4 bg-red-50 rounded-xl text-red-600 text-sm border border-red-200 animate-shake">
                        {apiError}
                      </div>
                    )}

                    {/* Step 1: Basic Information */}
                    {currentStep === 1 && (
                      <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                          <h2 className="text-3xl font-bold text-gray-800 mb-2">Basic Information</h2>
                          <p className="text-gray-600">Let's start with your essential details</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Mobile Number <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </div>
                              <div className="absolute inset-y-0 left-12 flex items-center pointer-events-none text-gray-400">
                                +91
                              </div>
                              <input
                                type="tel"
                                className={`w-full rounded-xl border pl-20 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                  isFocused === 'phone_number' || errors.phone_number ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                placeholder="Enter mobile"
                                {...register('phone_number', {
                                  required: 'Mobile number is required',
                                  pattern: {
                                    value: /^\d{10}$/,
                                    message: 'Mobile number must be exactly 10 digits'
                                  }
                                })}
                                onFocus={() => handleFocus('phone_number')}
                                onBlur={handleBlur}
                                onInput={(e) => {
                                  const input = e.target as HTMLInputElement;
                                  // Remove any non-digit characters
                                  const value = input.value.replace(/\D/g, '');
                                  // Limit to 10 digits
                                  const truncatedValue = value.slice(0, 10);
                                  if (truncatedValue !== input.value) {
                                    input.value = truncatedValue;
                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                  }
                                }}
                              />
                            </div>
                            {errors.phone_number && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.phone_number.message}
                              </p>
                            )}
                          </div>

                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Full Name <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <input
                                type="text"
                                className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                  isFocused === 'name' || errors.name ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                placeholder="Your name"
                                {...register('name', { 
                                  required: 'Name is required',
                                  minLength: { value: 2, message: 'Name must be at least 2 characters' },
                                  pattern: {
                                    value: /^[a-zA-Z\s'-]+$/,
                                    message: 'Name should contain only letters, spaces, hyphens, and apostrophes'
                                  }
                                })}
                                onFocus={() => handleFocus('name')}
                                onBlur={handleBlur}
                                onInput={(e) => {
                                  const input = e.target as HTMLInputElement;
                                  const value = input.value.replace(/[^a-zA-Z\s'-]/g, '');
                                  if (value !== input.value) {
                                    input.value = value;
                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                  }
                                }}
                              />
                            </div>
                            {errors.name && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.name.message}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            OTP Verification <span className="text-rose-500 ml-1">*</span>
                          </label>
                          <div className="flex gap-3">
                            <div className="relative flex-1">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                              <input
                                type="text"
                                className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                  isFocused === 'otp_code' || errors.otp_code ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                placeholder="Enter OTP"
                                {...register('otp_code', {
                                  required: 'OTP is required',
                                  pattern: { value: /^\d{6}$/, message: 'OTP must be 6 digits' }
                                })}
                                onFocus={() => handleFocus('otp_code')}
                                onBlur={handleBlur}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={requestOtp}
                              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center"
                            >
                              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                              Send OTP
                            </button>
                          </div>
                          {errors.otp_code && (
                            <p className="mt-1 text-xs text-red-600 flex items-center">
                              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {errors.otp_code.message}
                            </p>
                          )}
                          {otpStatus && (
                            <p className="mt-1 text-xs text-gray-500 flex items-center">
                              <svg className="h-4 w-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              {otpStatus}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Password <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                              <input
                                type={showPassword ? "text" : "password"}
                                className={`w-full rounded-xl border pl-10 pr-12 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                  isFocused === 'password' || errors.password ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                placeholder="Create password"
                                {...register('password', {
                                  required: 'Password is required',
                                  minLength: { value: 8, message: 'Password must be at least 8 characters' }
                                })}
                                onFocus={() => handleFocus('password')}
                                onBlur={handleBlur}
                              />
                              <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                onClick={togglePasswordVisibility}
                              >
                                {showPassword ? (
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                  </svg>
                                ) : (
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                            {errors.password && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.password.message}
                              </p>
                            )}
                          </div>

                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Confirm Password <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                              </div>
                              <input
                                type={showConfirmPassword ? "text" : "password"}
                                className={`w-full rounded-xl border pl-10 pr-12 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                  isFocused === 'confirm_password' || errors.confirm_password ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                placeholder="Confirm password"
                                {...register('confirm_password', {
                                  required: 'Please confirm your password',
                                  validate: (value) => value === watch('password') || 'Passwords do not match'
                                })}
                                onFocus={() => handleFocus('confirm_password')}
                                onBlur={handleBlur}
                              />
                              <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                onClick={toggleConfirmPasswordVisibility}
                              >
                                {showConfirmPassword ? (
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                  </svg>
                                ) : (
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                            {errors.confirm_password && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.confirm_password.message}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Residential Details */}
                    {currentStep === 2 && (
                      <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                          <h2 className="text-3xl font-bold text-gray-800 mb-2">Residential Details</h2>
                          <p className="text-gray-600">Help us know where you're located</p>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Address Line 1 <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                              </div>
                              <input
                                type="text"
                                className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                  isFocused === 'address_line1' || errors.address_line1 ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                placeholder="House / Street"
                                {...register('address_line1', {
                                  required: 'Address line 1 is required'
                                })}
                                onFocus={() => handleFocus('address_line1')}
                                onBlur={handleBlur}
                              />
                            </div>
                            {errors.address_line1 && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.address_line1.message}
                              </p>
                            )}
                          </div>

                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Address Line 2 <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                              <input
                                type="text"
                                className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                  isFocused === 'address_line2' || errors.address_line2 ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                placeholder="Area / Landmark"
                                {...register('address_line2', {
                                  required: 'Address line 2 is required'
                                })}
                                onFocus={() => handleFocus('address_line2')}
                                onBlur={handleBlur}
                              />
                            </div>
                            {errors.address_line2 && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.address_line2.message}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                City / Town <span className="text-rose-500 ml-1">*</span>
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                </div>
                                <input
                                  type="text"
                                  className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                    isFocused === 'city' || errors.city ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                  }`}
                                  placeholder="City"
                                  {...register('city', {
                                    required: 'City is required',
                                    pattern: {
                                      value: /^[a-zA-Z\s'-]+$/,
                                      message: 'City should contain only letters, spaces, hyphens, and apostrophes'
                                    }
                                  })}
                                  onFocus={() => handleFocus('city')}
                                  onBlur={handleBlur}
                                  onInput={(e) => {
                                    const input = e.target as HTMLInputElement;
                                    const value = input.value.replace(/[^a-zA-Z\s'-]/g, '');
                                    if (value !== input.value) {
                                      input.value = value;
                                      input.dispatchEvent(new Event('input', { bubbles: true }));
                                    }
                                  }}
                                />
                              </div>
                              {errors.city && (
                                <p className="mt-1 text-xs text-red-600 flex items-center">
                                  <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  {errors.city.message}
                                </p>
                              )}
                            </div>

                            <div className="relative">
                              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                State <span className="text-rose-500 ml-1">*</span>
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <input
                                  type="text"
                                  className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                    isFocused === 'state' || errors.state ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                  }`}
                                  placeholder="State"
                                  {...register('state', {
                                    required: 'State is required',
                                    pattern: {
                                      value: /^[a-zA-Z\s'-]+$/,
                                      message: 'State should contain only letters, spaces, hyphens, and apostrophes'
                                    }
                                  })}
                                  onFocus={() => handleFocus('state')}
                                  onBlur={handleBlur}
                                  onInput={(e) => {
                                    const input = e.target as HTMLInputElement;
                                    const value = input.value.replace(/[^a-zA-Z\s'-]/g, '');
                                    if (value !== input.value) {
                                      input.value = value;
                                      input.dispatchEvent(new Event('input', { bubbles: true }));
                                    }
                                  }}
                                />
                              </div>
                              {errors.state && (
                                <p className="mt-1 text-xs text-red-600 flex items-center">
                                  <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  {errors.state.message}
                                </p>
                              )}
                            </div>

                            <div className="relative">
                              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                PIN Code <span className="text-rose-500 ml-1">*</span>
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <input
                                  type="text"
                                  className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                    isFocused === 'postal_code' || errors.postal_code ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                  }`}
                                  placeholder="PIN"
                                  {...register('postal_code', {
                                    required: 'PIN code is required',
                                    pattern: { 
                                      value: /^\d{6}$/, 
                                      message: 'PIN must be exactly 6 digits' 
                                    }
                                  })}
                                  onFocus={() => handleFocus('postal_code')}
                                  onBlur={handleBlur}
                                  onInput={(e) => {
                                    const input = e.target as HTMLInputElement;
                                    const value = input.value.replace(/\D/g, '');
                                    const truncatedValue = value.slice(0, 6);
                                    if (truncatedValue !== input.value) {
                                      input.value = truncatedValue;
                                      input.dispatchEvent(new Event('input', { bubbles: true }));
                                    }
                                  }}
                                />
                              </div>
                              {errors.postal_code && (
                                <p className="mt-1 text-xs text-red-600 flex items-center">
                                  <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  {errors.postal_code.message}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Spiritual Details */}
                    {currentStep === 3 && (
                      <div className="space-y-6 animate-fade-in">
                        <div className="text-center mb-8">
                          <h2 className="text-3xl font-bold text-gray-800 mb-2">Spiritual Details</h2>
                          <p className="text-gray-600">Share your spiritual and family information</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Date of Birth <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <input
                                type="date"
                                className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                  isFocused === 'date_of_birth' || errors.date_of_birth ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                {...register('date_of_birth', {
                                  required: 'Date of birth is required'
                                })}
                                onFocus={() => handleFocus('date_of_birth')}
                                onBlur={handleBlur}
                              />
                            </div>
                            {errors.date_of_birth && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.date_of_birth.message}
                              </p>
                            )}
                          </div>

                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Star (Nakshatra) <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <Controller
                              name="tamil_star"
                              control={control}
                              defaultValue=""
                              rules={{
                                required: 'Star is required',
                                validate: (value) =>
                                  value && nakshatraOptions.includes(value)
                                    ? true
                                    : 'Please select a star from the list',
                              }}
                              render={({ field }) => {
                                const normalizedSearch = starSearch.trim().toLowerCase();
                                const filteredStars = nakshatraOptions.filter((option) =>
                                  option.toLowerCase().includes(normalizedSearch)
                                );

                                return (
                                  <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                      </svg>
                                    </div>
                                    <input
                                      ref={starInputRef}
                                      type="text"
                                      value={isStarDropdownOpen ? starSearch : field.value ?? ''}
                                      className={`w-full rounded-xl border pl-10 pr-12 py-3 capitalize focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                        isFocused === 'tamil_star' || errors.tamil_star ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                      }`}
                                      placeholder="Search Nakshatra"
                                      onFocus={() => {
                                        handleFocus('tamil_star');
                                        setStarSearch(field.value ?? '');
                                        setIsStarDropdownOpen(true);
                                      }}
                                      onBlur={() => {
                                        setTimeout(() => {
                                          setIsStarDropdownOpen(false);
                                          handleBlur();
                                          field.onBlur();
                                        }, 120);
                                      }}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setStarSearch(value);
                                        if (!isStarDropdownOpen) {
                                          setIsStarDropdownOpen(true);
                                        }
                                        if (value === '') {
                                          field.onChange('');
                                        }
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                          event.preventDefault();
                                          const exactMatch = nakshatraOptions.find(
                                            (option) => option.toLowerCase() === normalizedSearch
                                          );
                                          const selection = exactMatch ?? filteredStars[0];
                                          if (selection) {
                                            field.onChange(selection);
                                            setStarSearch(selection);
                                            setIsStarDropdownOpen(false);
                                            requestAnimationFrame(() => {
                                              starInputRef.current?.blur();
                                            });
                                          }
                                        }
                                        if (event.key === 'Escape') {
                                          setIsStarDropdownOpen(false);
                                          requestAnimationFrame(() => {
                                            starInputRef.current?.blur();
                                          });
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                      onMouseDown={(event) => {
                                        event.preventDefault();
                                        if (isStarDropdownOpen) {
                                          setIsStarDropdownOpen(false);
                                          requestAnimationFrame(() => {
                                            starInputRef.current?.blur();
                                          });
                                        } else {
                                          setStarSearch(field.value ?? '');
                                          setIsStarDropdownOpen(true);
                                          requestAnimationFrame(() => {
                                            starInputRef.current?.focus();
                                          });
                                        }
                                      }}
                                      aria-label="Toggle Nakshatra options"
                                    >
                                      <svg className={`h-5 w-5 transition-transform ${isStarDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    {isStarDropdownOpen && (
                                      <ul
                                        className="absolute z-20 mt-2 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
                                        role="listbox"
                                      >
                                        {filteredStars.length > 0 ? (
                                          filteredStars.map((option) => (
                                            <li
                                              key={option}
                                              className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 capitalize"
                                              onMouseDown={(event) => {
                                                event.preventDefault();
                                                field.onChange(option);
                                                setStarSearch(option);
                                                setIsStarDropdownOpen(false);
                                                requestAnimationFrame(() => {
                                                  starInputRef.current?.blur();
                                                });
                                              }}
                                            >
                                              {option}
                                            </li>
                                          ))
                                        ) : (
                                          <li className="px-4 py-2 text-sm text-gray-500">
                                            No matches found
                                          </li>
                                        )}
                                      </ul>
                                    )}
                                  </div>
                                );
                              }}
                            />
                            {errors.tamil_star && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.tamil_star.message}
                              </p>
                            )}
                          </div>

                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Gothram <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </div>
                              <select
                                className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 appearance-none ${
                                  isFocused === 'gothra' || errors.gothra ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                {...register('gothra', {
                                  required: 'Gothram is required'
                                })}
                                onFocus={() => handleFocus('gothra')}
                                onBlur={handleBlur}
                              >
                                <option value="">Select Gothram</option>
                                <option value="Atri">Atri</option>
                                <option value="Bharadvaja">Bharadvaja</option>
                                <option value="Gautama">Gautama</option>
                                <option value="Jamadagni">Jamadagni</option>
                                <option value="Kashyapa">Kashyapa</option>
                                <option value="Vasishta">Vasishta</option>
                                <option value="Vishvamitra">Vishvamitra</option>
                                <option value="Agastya">Agastya</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                            {errors.gothra && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.gothra.message}
                              </p>
                            )}
                          </div>

                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Gender <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <select
                                className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 appearance-none ${
                                  isFocused === 'gender' || errors.gender ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                {...register('gender', {
                                  required: 'Gender is required'
                                })}
                                onFocus={() => handleFocus('gender')}
                                onBlur={handleBlur}
                              >
                                <option value="">Select gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="non_binary">Non-binary</option>
                                <option value="prefer_not_to_say">Prefer not to say</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                            {errors.gender && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.gender.message}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            Family <span className="text-rose-500 ml-1">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                            <select
                              className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 appearance-none ${
                                isFocused === 'family_selection' || errors.family_selection ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                              }`}
                              {...register('family_selection', {
                                required: 'Family selection is required'
                              })}
                              onFocus={() => handleFocus('family_selection')}
                              onBlur={handleBlur}
                            >
                              <option value="">Select a family</option>
                              <option value="Arunachalam-Sambasiva Iyr">
                                Arunachalam-Sambasiva Iyr
                              </option>
                              <option value="Kadakarar Subramani Iyr">
                                Kadakarar Subramani Iyr
                              </option>
                              <option value="Sundaresa Iyr+ Pannai+Balu Fmly">
                                Sundaresa Iyr+ Pannai+Balu Fmly
                              </option>
                              <option value="Narayanswamy fmly">
                                Narayanswamy fmly
                              </option>
                              <option value="Mangalam Periyamma Fmly">
                                Mangalam Periyamma Fmly
                              </option>
                              <option value="Koorakattu Fmly">Koorakattu Fmly</option>
                              <option value="RamaniSastri Fmly">
                                RamaniSastri Fmly
                              </option>
                              <option value="Pichu Iyr Fmly">Pichu Iyr Fmly</option>
                              <option value="Pattamani Iyr Fmly">
                                Pattamani Iyr Fmly
                              </option>
                              <option value="other">Other</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                          {errors.family_selection && (
                            <p className="mt-1 text-xs text-red-600 flex items-center">
                              <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {errors.family_selection.message}
                            </p>
                          )}
                        </div>

                        {familySelection === 'other' && (
                          <div className="relative animate-fade-in">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Family Name <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <input
                                type="text"
                                className={`w-full rounded-xl border pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                  isFocused === 'family_name' || errors.family_name ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                placeholder="Enter family name"
                                {...register('family_name', {
                                  required: 'Family name is required when "Other" is selected'
                                })}
                                onFocus={() => handleFocus('family_name')}
                                onBlur={handleBlur}
                              />
                            </div>
                            {errors.family_name && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.family_name.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="mt-10 flex justify-between">
                      {currentStep > 1 && (
                        <button
                          type="button"
                          onClick={prevStep}
                          className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all duration-300 shadow hover:shadow-md transform hover:-translate-y-0.5 flex items-center"
                        >
                          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                          </svg>
                          Previous
                        </button>
                      )}
                      
                      {currentStep < 3 ? (
                        <button
                          type="button"
                          onClick={nextStep}
                          className="ml-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center"
                        >
                          Next
                          <svg className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="ml-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Creating account…
                            </>
                          ) : (
                            <>
                              Complete Registration
                              <svg className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="mt-6 text-center text-sm text-gray-600">
                      Already registered?{' '}
                      <Link to="/login" className="font-medium text-amber-600 hover:text-amber-700 transition-colors">
                        Sign in
                      </Link>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 py-4 text-center text-white/60 text-xs z-10">
        <p>© {new Date().getFullYear()} Kakkazhany Gramam. All rights reserved.</p>
      </footer>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(10px, 10px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-15px, 5px); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(5px, -15px); }
        }
        @keyframes float4 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-10px, -10px); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-float1 { animation: float1 6s ease-in-out infinite; }
        .animate-float2 { animation: float2 8s ease-in-out infinite; }
        .animate-float3 { animation: float3 7s ease-in-out infinite; }
        .animate-float4 { animation: float4 9s ease-in-out infinite; }
        .animate-fade-in { animation: fade-in 0.6s ease-out; }
        .animate-fade-in-up { animation: fade-in-up 0.8s ease-out; }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
};

export default RegisterPage;
