import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  {
    title: 'Personalized Darshan Alerts',
    description:
      'Get notified about auspicious timings, seva availability, and festival updates tailored to your family tradition.',
  },
  {
    title: 'Unified Family Records',
    description:
      'Maintain your gothram, star, and family participation history in one sacred profile for future generations.',
  },
  {
    title: 'Digital Seva & Donation History',
    description:
      'Track contributions, download receipts, and plan your upcoming offerings with ease.',
  },
] as const;

const onboardingSteps = [
  {
    number: '01',
    title: 'Verify Mobile & OTP',
    description:
      'We use your mobile number to keep your family informed about darshan schedules and temple updates.',
  },
  {
    number: '02',
    title: 'Share Family Lineage',
    description:
      'Add gothram, star, and family details to connect rituals and ceremonies to your tradition.',
  },
  {
    number: '03',
    title: 'Access Member Dashboard',
    description:
      'Manage seva bookings, donations, and special event passes online anytime.',
  },
] as const;

const RegisterPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [otpStatus, setOtpStatus] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
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
      family_name: '',
      family_selection: '',
      password: '',
      confirm_password: '',
      otp_code: '',
    },
  });

  const familySelection = watch('family_selection');

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

  const onSubmit = async (values: FormValues) => {
    setApiError(null);
    const { family_selection, family_name: familyNameInput, ...rest } = values;
    const payload: Record<string, unknown> = {
      ...rest,
      family_name:
        family_selection === 'other' ? familyNameInput : family_selection,
    };

    if (!values.date_of_birth) delete payload.date_of_birth;
    if (!payload.family_name) delete payload.family_name;

    try {
      const { data } = await api.post('/auth/register/', payload);
      setAuth({ user: data.user, tokens: data.tokens });
      navigate('/dashboard');
    } catch (error: any) {
      const detail =
        error?.response?.data ?? error?.message ?? 'Registration failed';
      setApiError(
        typeof detail === 'string'
          ? detail
          : 'Unable to register. Verify your OTP and details.'
      );
    }
  };

  // Shared styles for nav buttons to keep alignment identical
  const navBtn =
    'inline-flex h-10 items-center justify-center rounded-full px-5 whitespace-nowrap leading-none text-white transition shadow-sm';

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
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-10 h-64 w-64 rounded-full bg-[#f3c85c]/20 blur-3xl" />
        <div className="absolute bottom-[-4rem] right-[-4rem] h-96 w-96 rounded-full bg-[#f06f4a]/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,209,112,0.2),transparent_55%)]" />
      </div>

      {/* HEADER */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="bg-transparent text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
            {/* Left: branding */}
            <Link
              to="/"
              className="flex min-w-0 flex-col gap-1 text-left shrink-0"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-200">
                Agraharam Temple&apos;s
              </p>
              <p className="text-xs text-white/80">
                The Architectural Marvel of Agraharam
              </p>
            </Link>

            {/* Right: nav + CTAs */}
            <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-white">
              {navLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-white transition hover:text-[#f4ba1a]"
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
                  {/* prevent two-line wrap */}
                  Sign&nbsp;Up
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 pb-14 pt-36">
        <div className="grid w-full max-w-6xl gap-8 rounded-[2.75rem] bg-white/10 p-10 backdrop-blur-xl ring-1 ring-white/10 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col justify-between gap-10 text-amber-50">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#f4c956]">
                Join the Devotee Community
              </span>
              <div className="space-y-4">
                <h1 className="text-3xl font-bold leading-snug text-white sm:text-4xl">
                  Create your sacred profile for Agraharam Kovil&apos;s
                </h1>
                <p className="max-w-xl text-base text-amber-50/85 sm:text-lg">
                  Register once to manage darshan bookings, seva offerings,
                  annadanam contributions, and receive festival updates tailored to
                  your family&apos;s tradition.
                </p>
              </div>
            </div>

            <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6">
              {benefits.map((item) => (
                <div key={item.title} className="rounded-2xl bg-white/5 p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f4c956]">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm text-amber-50/85">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {onboardingSteps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <p className="text-2xl font-semibold text-[#f4c956]">
                    {step.number}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {step.title}
                  </p>
                  <p className="mt-2 text-xs text-amber-50/70">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2.25rem] bg-white p-8 shadow-[0_45px_70px_-40px_rgba(15,23,42,0.55)] lg:p-10">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-semibold text-slate-900">
                  Create your devotee account
                </h2>
                <p className="text-sm text-slate-500">
                  Complete the form below to access the temple member dashboard.
                  OTP verification keeps your account secure.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {apiError && (
                  <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-inner">
                    {apiError}
                  </p>
                )}

                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Contact & Verification
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        placeholder="Enter mobile"
                        {...register('phone_number', {
                          required: 'Mobile number required',
                        })}
                      />
                      {errors.phone_number && (
                        <p className="text-xs text-rose-600">
                          {errors.phone_number.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Full Name
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        placeholder="Your name"
                        {...register('name', { required: 'Name is required' })}
                      />
                      {errors.name && (
                        <p className="text-xs text-rose-600">
                          {errors.name.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        OTP
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        placeholder="Enter OTP"
                        {...register('otp_code', {
                          required: 'Enter OTP to continue',
                        })}
                      />
                      {errors.otp_code && (
                        <p className="text-xs text-rose-600">
                          {errors.otp_code.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col justify-end gap-2">
                      <button
                        type="button"
                        onClick={requestOtp}
                        className="rounded-2xl bg-gradient-to-r from-rose-600 to-amber-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white shadow-lg transition hover:brightness-105"
                      >
                        Send OTP
                      </button>
                      {otpStatus && (
                        <span className="text-[11px] text-slate-500">
                          {otpStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Residential Details
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Address Line 1
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="House / Street"
                        {...register('address_line1')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="Area / Landmark"
                        {...register('address_line2')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Address Line 3
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="Village / Taluk"
                        {...register('address_line3')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        City / Town
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="City"
                        {...register('city')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        State
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="State"
                        {...register('state')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        PIN Code
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="PIN"
                        {...register('postal_code')}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Spiritual Details
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        {...register('date_of_birth')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Star
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="Nakshatra"
                        {...register('tamil_star')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Gothram
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="Gothram"
                        {...register('gothra')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Family
                      </label>
                      <select
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        {...register('family_selection')}
                      >
                        <option value="">Select a family</option>
                        <option value="1">Family 1</option>
                        <option value="2">Family 2</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  {familySelection === 'other' && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Family Name
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="Enter family name"
                        {...register('family_name')}
                      />
                    </div>
                  )}
                </div>

                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Security
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Password
                      </label>
                      <input
                        type="password"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="Create password"
                        {...register('password', {
                          required: 'Password is required',
                          minLength: { value: 6, message: 'Min 6 characters' },
                        })}
                      />
                      {errors.password && (
                        <p className="text-xs text-rose-600">
                          {errors.password.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-amber-500 focus:outline-none"
                        placeholder="Confirm password"
                        {...register('confirm_password', {
                          required: 'Please confirm password',
                        })}
                      />
                      {errors.confirm_password && (
                        <p className="text-xs text-rose-600">
                          {errors.confirm_password.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#f06f4a] to-[#f4c956] px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating account…' : 'Register'}
                </button>

                <p className="text-center text-sm text-slate-500">
                  Already registered?{' '}
                  <Link to="/login" className="font-semibold text-rose-600 hover:text-rose-700">
                    Sign in
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
