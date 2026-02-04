// LoginPage.jsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { countryDialCodes, CountryDialCode } from '../data/countryDialCodes';
import { publicHeaderLinks } from '../data/publicHeaderLinks';
import { CountryCodePicker } from '../components/CountryCodePicker';
import { CountryOption } from '../types/country';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

type FormValues = {
  phone_number: string;
  password: string;
};

const features = [
  { icon: '🙏', title: 'Daily Darshan', description: 'Priority access to temple darshan slots' },
  { icon: '📿', title: 'Ritual Services', description: 'Book and manage special poojas and rituals' },
  { icon: '🌟', title: 'Spiritual Content', description: 'Personalized spiritual guidance and updates' },
] as const;

const testimonials = [
  {
    quote: "The portal has transformed how I connect with my spiritual practices. Booking darshan is now effortless!",
    author: "Priya Sharma",
    role: "Devotee since 2020"
  },
  {
    quote: "Managing our family rituals has never been easier. The reminders and scheduling features are invaluable.",
    author: "Rajesh Iyer",
    role: "Community Member"
  }
] as const;

const countryCodeOptions: CountryOption[] = countryDialCodes.map((entry) => ({
  code: entry.dialCode,
  label: entry.name,
  iso: entry.iso2,
}));

const defaultCountry = countryCodeOptions.find((option) => option.iso.toUpperCase() === 'IN') ?? countryCodeOptions[0];

const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { phone_number: '', password: '' },
  });

  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(defaultCountry);
  const [localPhoneNumber, setLocalPhoneNumber] = useState('');
  const [forceInternationalInput, setForceInternationalInput] = useState(false);
  const combinedPhoneNumber = (() => {
    if (!localPhoneNumber) {
      return '';
    }
    if (forceInternationalInput) {
      const internationalDigits = localPhoneNumber.startsWith('00')
        ? localPhoneNumber.slice(2)
        : localPhoneNumber;
      if (internationalDigits) {
        return `+${internationalDigits}`;
      }
    }
    return `${selectedCountry.code}${localPhoneNumber}`;
  })();
  useEffect(() => {
    setValue('phone_number', combinedPhoneNumber);
  }, [combinedPhoneNumber, setValue]);

  const handleCountryCodeChange = (iso: CountryOption['iso']) => {
    const option = countryCodeOptions.find((item) => item.iso === iso);
    if (option) {
      setSelectedCountry(option);
    }
  };

  const handleLocalPhoneInput = (value: string) => {
    const trimmedValue = value.trim();
    const digits = trimmedValue.replace(/\D/g, '').slice(0, 15);
    const explicitInternational =
      Boolean(trimmedValue) &&
      (trimmedValue.startsWith('+') ||
        trimmedValue.startsWith('00') ||
        digits.startsWith('00'));
    setLocalPhoneNumber(digits);
    setForceInternationalInput(explicitInternational);
  };

  const redirectToDashboard = () => {
    navigate('/dashboard', { replace: true });
    if (typeof window !== 'undefined') {
      window.location.replace('/dashboard');
    }
  };

  const onSubmit = async (values: FormValues) => {
    setApiError(null);
    try {
      const { data } = await api.post('/auth/login/', values);
      setAuth({ user: data.user, tokens: data.tokens });
      redirectToDashboard();
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ??
        'Unable to login. Please check your credentials.';
      setApiError(detail);
    }
  };

  const navBtn =
    'inline-flex h-10 items-center justify-center rounded-full px-5 whitespace-nowrap leading-none text-white transition-all duration-300 shadow-sm hover:shadow-lg transform hover:-translate-y-0.5';

  const handleFocus = (fieldName: string) => {
    setIsFocused(fieldName);
  };

  const handleBlur = () => {
    setIsFocused(null);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(rgba(9,2,3,0.94), rgba(9,2,3,0.95)), url("https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1800&q=80")',
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
        <div className="responsive-layout flex items-center py-3 text-white lg:px-10">
            <div className="flex h-16 w-full items-center justify-between">
              <Link
                to="/"
                className="flex min-w-0 flex-col gap-1 text-left shrink-0 group"
              >
                <p className="text-sm sm:text-base font-semibold uppercase tracking-[0.28em] text-amber-200 group-hover:text-amber-100 transition-colors">
                  Kakkalani Gramam
                </p>
              </Link>
              
              {/* Desktop Nav */}
              <div className="hidden md:flex items-center gap-4 sm:gap-6 text-sm font-semibold">
              {publicHeaderLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="text-white transition-all duration-300 hover:text-[#f4ba1a] hover:scale-105"
                >
                  {item.label}
                </Link>
              ))}
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link
                    to="/register"
                    className={`${navBtn} bg-[#f06f4a] hover:bg-[#ff8a60] text-xs sm:text-sm`}
                  >
                    Sign&nbsp;Up
                  </Link>
                </div>
              </div>

              {/* Mobile Hamburger Button */}
              <div className="md:hidden">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400"
                  aria-controls="mobile-menu"
                  aria-expanded={isMobileMenuOpen}
                >
                  <span className="sr-only">Open main menu</span>
                  {isMobileMenuOpen ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-8 6h8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-4/5 max-w-xs bg-gradient-to-b from-[#090203] to-gray-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <span className="text-base font-semibold uppercase tracking-[0.28em] text-amber-200">
                Menu
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-md p-2 text-white hover:bg-white/10"
              >
                <span className="sr-only">Close menu</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col space-y-4">
              {publicHeaderLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-white transition-all duration-300 hover:bg-white/10 hover:text-[#f4ba1a]"
                >
                  {item.label}
                </Link>
              ))}
              <hr className="border-white/20 pt-4" />
              <div className="flex flex-col space-y-3">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`${navBtn} bg-[#f06f4a] hover:bg-[#ff8a60] w-full`}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`${navBtn} bg-[#f06f4a] hover:bg-[#ff8a60] w-full`}
                >
                  Sign Up
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div className="relative z-10 flex items-center justify-center px-4 py-10 sm:py-12 sm:px-6 lg:px-10">
        <div className="w-full max-w-screen-2xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
            {/* Left Column - Content */}
            <div className="space-y-6 sm:space-y-8 animate-fade-in text-center sm:text-left">
              <div className="space-y-3 sm:space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f4c956] backdrop-blur-sm">
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4 tracking-tight">
                  Reconnect with Your <span className="text-amber-300">Sacred Journey</span>
                </h1>
                <p className="text-base sm:text-lg md:text-xl text-amber-100 leading-relaxed max-w-2xl mx-auto sm:mx-0">
                  Sign in to access personalized darshan slots, ritual schedules, and community seva opportunities
                </p>
              </div>
              
              {/* Features */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold text-amber-200">Portal Features</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {features.map((feature, index) => (
                    <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 transition-all duration-300 hover:bg-white/20">
                      <div className="text-xl sm:text-2xl mb-2">{feature.icon}</div>
                      <h4 className="font-semibold text-white text-sm sm:text-base">{feature.title}</h4>
                      <p className="text-xs text-amber-100/80 mt-1">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Testimonials - Hidden on mobile, shown on md and up */}
              <div className="space-y-3 sm:space-y-4 hidden md:block">
                <h3 className="text-base sm:text-lg font-semibold text-amber-200">Community Voices</h3>
                <div className="space-y-3 sm:space-y-4">
                  {testimonials.map((testimonial, index) => (
                    <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 border-l-4 border-amber-400">
                      <p className="text-amber-50 italic mb-2 text-sm">"{testimonial.quote}"</p>
                      <div>
                        <p className="font-medium text-white text-sm">{testimonial.author}</p>
                        <p className="text-xs text-amber-100/70">{testimonial.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Stats */}
              <div className="flex flex-wrap justify-center sm:justify-start items-center gap-4 sm:gap-6 pt-2 sm:pt-4 text-sm">
                <div className="flex items-center">
                  <span className="text-amber-300 font-bold text-lg sm:text-xl mr-2">70K+</span>
                  <span className="text-xs font-medium text-[#f4c956] uppercase tracking-wider">
                    Annual Devotees
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-amber-300 font-bold text-lg sm:text-xl mr-2">120+</span>
                  <span className="text-xs font-medium text-[#f4c956] uppercase tracking-wider">
                    Daily Sevas
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-amber-300 font-bold text-lg sm:text-xl mr-2">24/7</span>
                  <span className="text-xs font-medium text-[#f4c956] uppercase tracking-wider">
                    Support
                  </span>
                </div>
              </div>
            </div>
            
            {/* Right Column - Form */}
            <div className="animate-fade-in-up w-full max-w-md mx-auto lg:max-w-xl">
              {/* Progress Steps */}
              <div className="mb-6 sm:mb-8">
                <div className="flex justify-center mb-4 sm:mb-6">
                  <div className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-base sm:text-lg font-bold mb-2 sm:mb-3 bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-lg"
                      >
                        1
                      </div>
                      <div className="text-center">
                        <div className="text-base font-semibold text-amber-300">
                          Sign In
                        </div>
                        <div className="text-xs text-white/60 max-w-[120px]">
                          Enter your credentials
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-1 shadow-2xl">
                <div className="bg-white rounded-3xl overflow-hidden shadow-xl">
                  <form onSubmit={handleSubmit(onSubmit)} className="p-5 sm:p-6 md:p-8">
                    {apiError && (
                      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 rounded-xl text-red-600 text-sm border border-red-200 animate-shake flex items-center">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {apiError}
                      </div>
                    )}
                    
                    <div className="space-y-4 sm:space-y-6">
                      <div className="text-center mb-6 sm:mb-8">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Sign In</h2>
                        <p className="text-gray-600 text-sm sm:text-base">Enter your credentials to access your dashboard</p>
                      </div>
                      
                      <div className="space-y-4 sm:space-y-5">
                      <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            Mobile Number <span className="text-rose-500 ml-1">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center">
                              <CountryCodePicker
                                options={countryCodeOptions}
                                selected={selectedCountry}
                                onSelect={(iso) => handleCountryCodeChange(iso)}
                                isFocused={isFocused === 'phone_number'}
                                hasError={!!errors.phone_number}
                                onFocus={() => handleFocus('phone_number')}
                                onBlur={handleBlur}
                              />
                            </div>
                          <input
                              type="tel"
                              value={localPhoneNumber}
                              className={`w-full rounded-xl border pl-36 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                isFocused === 'phone_number' || errors.phone_number ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                              }`}
                              placeholder="Enter your mobile number"
                              onChange={(event) => handleLocalPhoneInput(event.target.value)}
                              onFocus={() => handleFocus('phone_number')}
                              onBlur={handleBlur}
                            />
                            <input
                              type="hidden"
                              {...register('phone_number', {
                                required: 'Mobile number is required',
                                pattern: {
                                  value: /^\+?[0-9]{7,15}$/,
                                  message: 'Enter a valid international mobile number',
                                },
                              })}
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
                          <label className="flex flex-col sm:flex-row sm:items-center justify-between text-sm font-medium text-gray-700 mb-1">
                            <span>Password <span className="text-rose-500 ml-1">*</span></span>
                            <Link
                              to="/forgot-password"
                              className="text-xs text-amber-600 hover:text-amber-700 transition-colors mt-1 sm:mt-0"
                            >
                              Forgot?
                            </Link>
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
                              placeholder="Enter your password"
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
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="remember-me"
                          name="remember-me"
                          type="checkbox"
                          className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                        />
                        <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                          Remember me
                        </label>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Signing in…
                          </>
                        ) : (
                          <>
                            Sign In
                            <svg className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </>
                        )}
                      </button>
                      
                      <div className="text-center text-sm text-gray-600">
                        New devotee?{' '}
                        <Link
                          to="/register"
                          className="font-medium text-amber-600 hover:text-amber-700 transition-colors"
                        >
                          Create your account
                        </Link>
                      </div>
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
        <p>© {new Date().getFullYear()} Kakkalani Gramam. All rights reserved.</p>
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

export default LoginPage;
