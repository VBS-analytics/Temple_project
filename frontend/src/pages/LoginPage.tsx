// LoginPage.jsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { countryDialCodes } from '../data/countryDialCodes';
import { CountryCodePicker } from '../components/CountryCodePicker';
import PublicSiteHeader from '../components/PublicSiteHeader';
import LandingPage from './LandingPage';
import { CountryOption } from '../types/country';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

type FormValues = {
  phone_number: string;
  password: string;
};

const countryCodeOptions: CountryOption[] = countryDialCodes.map((entry) => ({
  code: entry.dialCode,
  label: entry.name,
  iso: entry.iso2,
}));

const defaultCountry = countryCodeOptions.find((option) => option.iso.toUpperCase() === 'IN') ?? countryCodeOptions[0];

const loginHeroSlides = [
  { src: '/images/landing-page-image.jpg', fit: 'cover' as const },
  { src: '/images/kovi/lakshmi-narayanar/lakshmi-narayanar.png', fit: 'contain' as const },
  { src: '/images/kovi/pillayar/pillayar-hd.jpg', fit: 'contain' as const },
  { src: '/images/kovi/kalahasteeswarar/kalahasteeswarar-hd.png', fit: 'contain' as const },
  { src: '/images/kovi/ayyanar/ayyanar-hd.jpg', fit: 'contain' as const },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroSlide((prev) => (prev + 1) % loginHeroSlides.length);
    }, 4500);
    return () => window.clearInterval(intervalId);
  }, []);

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

  const redirectToDashboard = (role?: string) => {
    const target = role && role.toLowerCase().includes('admin') ? '/admin/master' : '/profile';
    navigate(target, { replace: true });
    if (typeof window !== 'undefined') {
      window.location.replace(target);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setApiError(null);
    try {
      const { data } = await api.post('/auth/login/', values);
      setAuth({ user: data.user, tokens: data.tokens });
      redirectToDashboard(data.user?.role);
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ??
        'Unable to login. Please check your credentials.';
      setApiError(detail);
    }
  };

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
    <div className="bg-[#f7f1e6]">
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fbf5ea] to-[#fffdf8]" />
        {loginHeroSlides.map((slide, index) => (
          <img
            key={slide.src}
            src={slide.src}
            alt=""
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-700 ${
              slide.fit === 'cover' ? 'object-cover' : 'object-contain'
            } ${index === activeHeroSlide ? 'opacity-100' : 'opacity-0'}`}
            loading={index === 0 ? 'eager' : 'lazy'}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-white/35" />
        <PublicSiteHeader variant="amber" />

        {/* MAIN */}
        <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:items-start lg:justify-end lg:px-12 lg:pt-16">
          <div className="w-full max-w-screen-2xl lg:flex lg:justify-end">
            <div className="mx-auto w-full max-w-sm lg:mx-0 lg:max-w-[320px]">
            {/* Form */}
            <div className="animate-fade-in-up w-full">
              {/* Progress Steps */}
              <div className="mb-4 sm:mb-6" />
              
              <div className="rounded-3xl border border-[#efd9cf]/80 bg-[#fff7ed]/65 p-1 shadow-2xl backdrop-blur-md">
                <div className="overflow-hidden rounded-3xl bg-[#fffdf8]/82 shadow-xl backdrop-blur-sm">
                  <form onSubmit={handleSubmit(onSubmit)} className="p-3 sm:p-3.5 md:p-4">
                    {apiError && (
                      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 rounded-xl text-red-600 text-sm border border-red-200 animate-shake flex items-center">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {apiError}
                      </div>
                    )}
                    
                    <div className="space-y-2.5 sm:space-y-3">
                      <div className="text-center mb-3 sm:mb-4">
                        <h2 className="mb-1 text-lg font-bold text-[#7e2a20] sm:text-xl">Sign In</h2>
                      </div>
                      
                      <div className="space-y-2.5 sm:space-y-3">
                      <div className="relative">
                          <label className="mb-1 flex items-center text-xs font-medium text-[#5f4636] sm:text-sm">
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
                              className={`w-full rounded-xl border bg-white/90 py-2 pl-36 pr-4 text-[#2f2a26] placeholder:text-[#8a7465] transition-all duration-300 focus:border-[#a33a2b] focus:ring-2 focus:ring-[#d8b8a0] ${
                                isFocused === 'phone_number' || errors.phone_number ? 'border-[#a33a2b] shadow-sm' : 'border-[#d8c2b3]'
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
                          <label className="mb-1 flex items-center text-xs font-medium text-[#5f4636] sm:text-sm">
                            <span>Password <span className="text-rose-500 ml-1">*</span></span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg className="h-5 w-5 text-[#8a7465]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                            <input
                              type={showPassword ? "text" : "password"}
                              className={`w-full rounded-xl border bg-white/90 py-2 pl-10 pr-12 text-[#2f2a26] placeholder:text-[#8a7465] transition-all duration-300 focus:border-[#a33a2b] focus:ring-2 focus:ring-[#d8b8a0] ${
                                isFocused === 'password' || errors.password ? 'border-[#a33a2b] shadow-sm' : 'border-[#d8c2b3]'
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
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#8a7465] hover:text-[#7e2a20]"
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
                        <label htmlFor="remember-me" className="ml-2 block text-xs text-[#5f4636] sm:text-sm">
                          Remember me
                        </label>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="relative flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#a33a2b] to-[#7e2a20] px-6 py-2 font-medium text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:from-[#8e3125] hover:to-[#682117] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
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
                            <span className="mx-auto">Sign In</span>
                            <svg className="absolute right-6 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </>
                        )}
                      </button>
                      
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      </div>

      <LandingPage showHeader={false} showHero={false} />
      
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
