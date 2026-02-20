// ForgotPasswordPage.jsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import PublicSiteHeader from '../components/PublicSiteHeader';

import api from '../lib/api';
import { countryDialCodes, CountryDialCode } from '../data/countryDialCodes';

type FormValues = {
  phone_number: string;
  new_password: string;
  confirm_password: string;
};

type CountryOption = {
  code: CountryDialCode['dialCode'];
  label: CountryDialCode['name'];
  iso: CountryDialCode['iso2'];
};

const countryCodeOptions: CountryOption[] = countryDialCodes.map((entry) => ({
  code: entry.dialCode,
  label: entry.name,
  iso: entry.iso2,
}));

const defaultCountry = countryCodeOptions.find((option) => option.iso.toUpperCase() === 'IN') ?? countryCodeOptions[0];

const flagEmoji = (iso: string) =>
  iso
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

const flattenErrorValues = (value: unknown): string[] => {
  if (value == null) {
    return [];
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(flattenErrorValues);
  }
  if (typeof value === 'object') {
    return Object.values(value).flatMap(flattenErrorValues);
  }
  return [];
};

const getApiErrorMessage = (detail: unknown): string => {
  if (!detail) {
    return 'Unable to reset password';
  }
  if (typeof detail === 'string') {
    return detail;
  }
  const flattened = flattenErrorValues(detail);
  return flattened.length > 0 ? flattened.join(' ') : 'Check the details and try again.';
};

const features = [
  { icon: '🔐', title: 'Secure Reset', description: 'Safely reset your password in just a couple of steps' },
  { icon: '⚡', title: 'Quick Process', description: 'Reset your password in just a few simple steps' },
  { icon: '📱', title: 'Mobile First', description: 'Designed for seamless mobile experience' },
] as const;

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(defaultCountry);
  const [localPhoneNumber, setLocalPhoneNumber] = useState('');
  const combinedPhoneNumber = localPhoneNumber ? `${selectedCountry.code}${localPhoneNumber}` : '';
  const selectedCountryFlag = selectedCountry.iso ? flagEmoji(selectedCountry.iso) : '🌐';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      phone_number: '',
      new_password: '',
      confirm_password: '',
    },
  });

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
    const digits = value.replace(/\D/g, '').slice(0, 15);
    setLocalPhoneNumber(digits);
  };

  const onSubmit = async (values: FormValues) => {
    setApiError(null);
    try {
      await api.post('/auth/reset-password/', values);
      setIsSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (error: any) {
      const rawDetail = error?.response?.data ?? error?.message;
      setApiError(getApiErrorMessage(rawDetail));
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

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(rgba(9,2,3,0.94), rgba(9,2,3,0.95)), url("/images/landing-page-image.jpg")',
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

      <PublicSiteHeader variant="overlay" />

      {/* MAIN */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 pb-14 pt-36 lg:px-10">
        <div className="w-full max-w-screen-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Content */}
            <div className="space-y-8 animate-fade-in">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#f4c956] backdrop-blur-sm">
                  Password Recovery
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                  Reset Your <span className="text-amber-300">Password</span>
                </h1>
                <p className="text-lg md:text-xl text-amber-100 leading-relaxed">
                  Regain access to your account with our secure password reset process.
                </p>
              </div>

              {/* Features */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-amber-200">Reset Features</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {features.map((feature, index) => (
                    <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 transition-all duration-300 hover:bg-white/20">
                      <div className="text-2xl mb-2">{feature.icon}</div>
                      <h4 className="font-semibold text-white">{feature.title}</h4>
                      <p className="text-xs text-amber-100/80 mt-1">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-amber-200">Simple Steps</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 rounded-full w-6 h-6 flex items-center justify-center bg-gradient-to-r from-amber-400 to-amber-600 text-white">
                      1
                    </div>
                    <div>
                      <div className="font-medium text-amber-300">Enter Mobile Number</div>
                      <div className="text-xs text-white/60">Provide your registered mobile number</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 rounded-full w-6 h-6 flex items-center justify-center bg-gradient-to-r from-amber-400 to-amber-600 text-white">
                      2
                    </div>
                    <div>
                      <div className="font-medium text-amber-300">Set New Password</div>
                      <div className="text-xs text-white/60">Choose a secure password to protect your account</div>
                    </div>
                  </div>
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
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-1 shadow-2xl">
                <div className="bg-white rounded-3xl overflow-hidden shadow-xl">
                  <div className="p-8">
                    {isSuccess ? (
                      <div className="text-center py-8">
                        <div className="flex justify-center mb-4">
                          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Password Reset Successful</h2>
                        <p className="text-gray-600 mb-6">Your password has been successfully updated. You will be redirected to the login page shortly.</p>
                        <Link
                          to="/login"
                          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300"
                        >
                          Back to Login
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="text-center mb-8">
                          <h2 className="text-3xl font-bold text-gray-800 mb-2">Reset Password</h2>
                          <p className="text-gray-600">Enter your details to reset your password</p>
                        </div>

                        {apiError && (
                          <div className="mb-6 p-4 bg-red-50 rounded-xl text-red-600 text-sm border border-red-200 animate-shake flex items-center">
                            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {apiError}
                          </div>
                        )}

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                          <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              Mobile Number <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 flex items-center">
                                <div
                                  className={`flex h-full items-center gap-2 rounded-l-xl border px-3 py-3 text-sm font-semibold ${
                                    isFocused === 'phone_number' || errors.phone_number ? 'border-amber-500 bg-white shadow-sm' : 'border-gray-300 bg-white'
                                  } pointer-events-none`}
                                >
                                  <span className="text-lg leading-none">{selectedCountryFlag}</span>
                                  <span>{selectedCountry.code}</span>
                                  <svg className="h-3 w-3 text-gray-500" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8l4 4 4-4" />
                                  </svg>
                                </div>
                                <select
                                  value={selectedCountry.iso}
                                  onChange={(event) => handleCountryCodeChange(event.target.value as CountryOption['iso'])}
                                  aria-label="Country code"
                                  className="absolute inset-y-0 left-0 w-32 opacity-0 cursor-pointer"
                                  onFocus={() => handleFocus('phone_number')}
                                  onBlur={handleBlur}
                                >
                                  {countryCodeOptions.map((option) => (
                                    <option key={option.iso} value={option.iso}>
                                      {option.label} ({option.code})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <input
                                type="tel"
                                value={localPhoneNumber}
                                className={`w-full rounded-xl border pl-32 pr-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 ${
                                  isFocused === 'phone_number' || errors.phone_number ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                placeholder="Enter your mobile number"
                                onFocus={() => handleFocus('phone_number')}
                                onBlur={handleBlur}
                                onChange={(event) => handleLocalPhoneInput(event.target.value)}
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
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              New Password <span className="text-rose-500 ml-1">*</span>
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
                                  isFocused === 'new_password' || errors.new_password ? 'border-amber-500 shadow-sm' : 'border-gray-300'
                                }`}
                                placeholder="Create new password"
                                {...register('new_password', {
                                  required: 'Password is required',
                                  minLength: { value: 8, message: 'Password must be at least 8 characters' }
                                })}
                                onFocus={() => handleFocus('new_password')}
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
                            {errors.new_password && (
                              <p className="mt-1 text-xs text-red-600 flex items-center">
                                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errors.new_password.message}
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
                                placeholder="Confirm new password"
                                {...register('confirm_password', {
                                  required: 'Please confirm your password',
                                  validate: (value) => value === watch('new_password') || 'Passwords do not match'
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
                                Resetting Password…
                              </>
                            ) : (
                              <>
                                Reset Password
                                <svg className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </>
                            )}
                          </button>

                          <div className="text-center text-sm text-gray-600">
                            Remembered your password?{' '}
                            <Link to="/login" className="font-medium text-amber-600 hover:text-amber-700 transition-colors">
                              Back to login
                            </Link>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
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

export default ForgotPasswordPage;
