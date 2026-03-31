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

const defaultCountry =
  countryCodeOptions.find((option) => option.iso.toUpperCase() === 'IN') ?? countryCodeOptions[0];

const mobileSlides = [
  { src: '/images/new-landing-page.jpg', alt: 'Kakkalani Village aerial view', fit: 'contain' },
  { src: '/images/kovi/lakshmi-narayanar/lakshmi-narayanar.png', alt: 'Lakshmi Narayanar', fit: 'contain' },
  { src: '/images/kovi/pillayar/pillayar-hd.jpg', alt: 'Aathagarai Pillayar', fit: 'contain' },
  { src: '/images/kovi/kalahasteeswarar/kalahasteeswarar-hd.png', alt: 'Kalahasteeswarar', fit: 'contain' },
  { src: '/images/kovi/ayyanar/ayyanar-hd.jpg', alt: 'Ayyanar', fit: 'contain' },
  { src: '/images/kovi/Damodara-Pillayar-Temple.png', alt: 'Damodara Pillayar', fit: 'contain' },
  { src: '/images/kovi/Mazhai-Mariamman.png', alt: 'Mazhai Mariamman', fit: 'contain' },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % mobileSlides.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

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
    if (!localPhoneNumber) return '';
    if (forceInternationalInput) {
      const internationalDigits = localPhoneNumber.startsWith('00')
        ? localPhoneNumber.slice(2)
        : localPhoneNumber;
      if (internationalDigits) return `+${internationalDigits}`;
    }
    return `${selectedCountry.code}${localPhoneNumber}`;
  })();

  useEffect(() => {
    setValue('phone_number', combinedPhoneNumber);
  }, [combinedPhoneNumber, setValue]);

  const handleCountryCodeChange = (iso: CountryOption['iso']) => {
    const option = countryCodeOptions.find((item) => item.iso === iso);
    if (option) setSelectedCountry(option);
  };

  const handleLocalPhoneInput = (value: string) => {
    const trimmedValue = value.trim();
    const digits = trimmedValue.replace(/\D/g, '').slice(0, 15);
    const explicitInternational =
      Boolean(trimmedValue) &&
      (trimmedValue.startsWith('+') || trimmedValue.startsWith('00') || digits.startsWith('00'));
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
        error?.response?.data?.detail ?? 'Unable to login. Please check your credentials.';
      setApiError(detail);
    }
  };

  const handleFocus = (fieldName: string) => setIsFocused(fieldName);
  const handleBlur = () => setIsFocused(null);
  const togglePasswordVisibility = () => setShowPassword((v) => !v);
  const activeSlide = mobileSlides[currentSlide];
  const isLandingMapSlide = activeSlide.src === '/images/new-landing-page.jpg';
  const mobileSlideHeight = 'clamp(340px, 78vw, 600px)';
  const desktopSlideFrameStyle = isLandingMapSlide
    ? ({ aspectRatio: '3 / 2', height: 'auto', minHeight: '620px' } as const)
    : ({ height: 'clamp(320px, 56vh, 620px)' } as const);

  return (
    <div>
      {/*
        LOGIN SECTION
          Mobile: Scrollable header + slideshow + LandingPage + fixed Sign In panel at bottom
          Desktop (lg+): Split panel — 80% village map image | 20% Sign In form
      */}

      {/* ═══ OUTER FLEX COL — header + marquee + content row ═══ */}
      <div className="flex flex-col min-h-screen lg:min-h-0">
        <PublicSiteHeader variant="amber" />

        {/* ═══ INNER CONTAINER — flex-col mobile / flex-row desktop ═══ */}
        <div className="flex flex-col flex-1 min-h-0 lg:flex-row lg:flex-none">

          {/* ── MOBILE ONLY: image slideshow ── */}
          <div
            className="lg:hidden relative flex-shrink-0 w-full overflow-hidden"
            style={{ height: mobileSlideHeight }}
          >
            {mobileSlides.map((slide, i) => (
              <div
                key={slide.src}
                className="absolute inset-0 transition-opacity duration-700 flex items-center justify-center bg-[#fbf5ea]"
                style={{ opacity: i === currentSlide ? 1 : 0 }}
              >
                <img
                  src={slide.src}
                  alt={slide.alt}
                  className="block object-contain"
                  style={{
                    width: slide.src === '/images/new-landing-page.jpg' ? '100%' : 'auto',
                    maxWidth: slide.src === '/images/new-landing-page.jpg' ? '100%' : '68%',
                    height: '100%',
                    maxHeight: '100%',
                  }}
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
            {/* Dot indicators */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
              {mobileSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentSlide(i)}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === currentSlide ? '18px' : '6px',
                    background: i === currentSlide ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* ── MOBILE ONLY: LandingPage content (scrollable, compact wrapper) ── */}
          <div className="lg:hidden login-lp-wrap">
            <LandingPage showHeader={false} showHero={false} />
          </div>

          {/* ── MOBILE ONLY: spacer so content clears the fixed panel ── */}
          <div className="lg:hidden h-[300px]" />

          {/* ── DESKTOP ONLY: left 80 % image panel ── */}
          <div className="hidden lg:block lg:w-4/5">
            <div
              className="relative overflow-hidden bg-[#fbf5ea]"
              style={desktopSlideFrameStyle}
            >
              {mobileSlides.map((slide, i) => (
                <div
                  key={`desktop-${slide.src}`}
                  className="absolute inset-0 transition-opacity duration-700 flex items-center justify-center bg-[#fbf5ea]"
                  style={{ opacity: i === currentSlide ? 1 : 0 }}
                >
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    className="block object-contain"
                    style={{
                      width: slide.src === '/images/new-landing-page.jpg' ? '100%' : 'auto',
                      maxWidth: slide.src === '/images/new-landing-page.jpg' ? '100%' : '62%',
                      height: '100%',
                      maxHeight: '100%',
                    }}
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                </div>
              ))}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                {mobileSlides.map((_, i) => (
                  <button
                    key={`desktop-dot-${i}`}
                    type="button"
                    onClick={() => setCurrentSlide(i)}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === currentSlide ? '18px' : '6px',
                      background: i === currentSlide ? '#fff' : 'rgba(255,255,255,0.5)',
                    }}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/*
            ── SIGN IN PANEL ──
            Mobile  : position:fixed — sits at bottom of viewport, out of flow
            Desktop : position:static — right 20 % column of the flex row
          */}
          <div
            className={[
              // Mobile: fixed bottom drawer
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-[#fdf6ec] rounded-t-[28px]',
              'shadow-[0_-6px_30px_rgba(0,0,0,.25)]',
              'px-5 pb-6 pt-4',
              // Desktop: static right column
              'lg:static lg:w-1/5',
              'lg:flex lg:items-center lg:justify-center',
              'lg:min-h-0 lg:rounded-none lg:shadow-none',
              'lg:px-6 lg:py-10',
            ].join(' ')}
          >
            {/* Drag handle — mobile only */}
            <div className="w-10 h-1 bg-[#e0ccb8] rounded-full mx-auto mb-3 lg:hidden" />
            {/* Accent bar — mobile only */}
            <div className="h-0.5 bg-gradient-to-r from-[#7e2a20] via-[#c8813a] to-[#f0d060] rounded-full mb-3 lg:hidden" />

            <div className="w-full">

              {/* Logo row — desktop only */}
              <div className="hidden lg:flex items-center gap-3 mb-5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-md"
                  style={{ background: 'linear-gradient(135deg,#7e2a20,#c8813a)' }}
                >
                  🛕
                </div>
                <div>
                  <div className="font-bold text-[#7e2a20] text-base">Kakkalani Village</div>
                </div>
              </div>

              {/* Heading */}
              <h2 className="text-xl font-bold text-[#3d1a0a] mb-1 lg:text-2xl">Sign In</h2>
              <p className="text-xs text-[#8a6a50] mb-3 lg:hidden">Enter your details to continue</p>
              <p className="hidden lg:block text-sm text-[#8a6a50] mb-5">
                Sign in to manage poojas, payments &amp; donor records.
              </p>

              {/* API error */}
              {apiError && (
                <div className="mb-3 p-2.5 bg-red-50 rounded-xl text-red-600 text-xs border border-red-200 flex items-center animate-shake">
                  <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {apiError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">

                {/* Mobile Number */}
                <div>
                  {/* Label hidden on mobile, shown on desktop */}
                  <label className="hidden lg:flex mb-1 items-center text-xs font-semibold text-[#5f4636] sm:text-sm">
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
                      className={`w-full rounded-xl border bg-white py-2.5 pl-36 pr-4 text-[#2f2a26] placeholder:text-[#8a7465] text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#d8b8a0] ${
                        isFocused === 'phone_number' || errors.phone_number
                          ? 'border-[#a33a2b] shadow-sm'
                          : 'border-[#e0ccb8]'
                      }`}
                      placeholder="Mobile number"
                      onChange={(e) => handleLocalPhoneInput(e.target.value)}
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
                      <svg className="h-3 w-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.phone_number.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  {/* Label hidden on mobile, shown on desktop */}
                  <label className="hidden lg:flex mb-1 items-center text-xs font-semibold text-[#5f4636] sm:text-sm">
                    Password <span className="text-rose-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-[#b08060]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-12 text-[#2f2a26] placeholder:text-[#8a7465] text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#d8b8a0] ${
                        isFocused === 'password' || errors.password
                          ? 'border-[#a33a2b] shadow-sm'
                          : 'border-[#e0ccb8]'
                      }`}
                      placeholder="Password"
                      {...register('password', {
                        required: 'Password is required',
                        minLength: { value: 8, message: 'Password must be at least 8 characters' },
                      })}
                      onFocus={() => handleFocus('password')}
                      onBlur={handleBlur}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#9a7a5a] hover:text-[#7e2a20]"
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
                      <svg className="h-3 w-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Remember me — desktop only */}
                <div className="hidden lg:flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#e0ccb8] accent-[#a33a2b]"
                  />
                  <label htmlFor="remember-me" className="ml-2 text-xs text-[#6b5040] sm:text-sm">
                    Remember me on this device
                  </label>
                </div>

                {/* Sign In button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="relative flex w-full items-center justify-center rounded-xl py-3 font-bold text-white text-sm shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ background: 'linear-gradient(135deg,#8b2e20,#c8813a)' }}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    <>
                      <span className="mx-auto">Sign In</span>
                      <svg className="absolute right-5 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>

              </form>

              {/* Help text — desktop only */}

            </div>
          </div>{/* end sign in panel */}

        </div>{/* end inner flex row */}
      </div>{/* end outer flex col */}

      {/* LandingPage — desktop only (mobile version is inside the scrollable area above) */}
      <div className="hidden lg:block">
        <LandingPage showHeader={false} showHero={false} />
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }

        /* ── Compact LandingPage stats/cards when shown in login mobile context ── */
        .login-lp-wrap .stats { padding: 1.25rem 0 0.75rem; }
        .login-lp-wrap .stats-grid { gap: 0.6rem; }
        .login-lp-wrap .stat-card { padding: 0.85rem 0.9rem; }
        .login-lp-wrap .stat-icon { width: 32px; height: 32px; margin-bottom: 0.4rem; border-radius: 0.6rem; }
        .login-lp-wrap .stat-icon svg { width: 16px; height: 16px; }
        .login-lp-wrap .stat-val { font-size: 0.82rem; margin-bottom: 0.2rem; }
        .login-lp-wrap .stat-lbl { font-size: 0.58rem; letter-spacing: .18em; }
      `}</style>
    </div>
  );
};

export default LoginPage;
