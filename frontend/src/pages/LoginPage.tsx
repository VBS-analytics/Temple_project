import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import LanguageToggle from '../components/LanguageToggle';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

type FormValues = {
  phone_number: string;
  password: string;
};

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

const highlights = [
  'Daily darshan updates and priority booking',
  'Manage seva schedules and donations in one place',
  'Personalized spiritual content curated for you',
] as const;

const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { phone_number: '', password: '' },
  });
  const [apiError, setApiError] = useState<string | null>(null);

  const onSubmit = async (values: FormValues) => {
    setApiError(null);
    try {
      const { data } = await api.post('/auth/login/', values);
      setAuth({ user: data.user, tokens: data.tokens });
      navigate('/dashboard');
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ??
        'Unable to login. Please check your credentials.';
      setApiError(detail);
    }
  };

  // Shared button styles to keep Login & Sign Up perfectly aligned
  const navBtn =
    'inline-flex h-10 items-center justify-center rounded-full px-4 whitespace-nowrap leading-none text-white shadow-sm transition';

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-slate-950"
      style={{
        backgroundImage:
          'url("https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1600&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* gradient overlays */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2c0a16]/90 via-[#130307]/92 to-[#090203]/96" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#ffb347]/25 blur-3xl" />
        <div className="absolute bottom-[-4rem] right-[-4rem] h-80 w-80 rounded-full bg-[#f5d26a]/20 blur-3xl" />
      </div>

      {/* HEADER */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="bg-transparent text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
            {/* Left: Logo/Title block */}
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

            {/* Right: Nav */}
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

              {/* Buttons grouped & aligned */}
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className={`${navBtn} bg-[#f06f4a] hover:bg-[#ff8a60]`}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className={`${navBtn} bg-[#f06f4a] hover:bg-[#ff8a60]`}
                >
                  {/* prevent wrap to a second line */}
                  Sign&nbsp;Up
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 pb-10 pt-32 md:pt-36">
        <div className="grid w-full max-w-5xl gap-10 rounded-[2.5rem] bg-white/10 p-10 backdrop-blur-xl ring-1 ring-white/10 lg:grid-cols-[1.15fr_1fr]">
          {/* Left panel */}
          <div className="flex flex-col justify-between gap-10 text-amber-50">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#f4c956]">
                Agraharam Temple — Member Portal
              </span>
              <div className="space-y-4">
                <h1 className="text-3xl font-bold leading-snug text-white sm:text-4xl">
                  Welcome back to your sacred journey
                </h1>
                <p className="max-w-lg text-base text-amber-50/80 sm:text-lg">
                  Sign in to access personalized darshan slots, ritual schedules,
                  temple news, and community seva opportunities curated for your
                  devotion.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-[#f4c956]">
                Why members love the portal
              </h2>
              <ul className="space-y-3 text-sm text-amber-50/90">
                {highlights.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#ffb347]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-6 text-xs uppercase tracking-[0.3em] text-amber-100/80">
                <div>
                  70K+{' '}
                  <span className="ml-1 text-[11px] font-medium text-[#f4c956]">
                    Annual Devotees
                  </span>
                </div>
                <div>
                  120+{' '}
                  <span className="ml-1 text-[11px] font-medium text-[#f4c956]">
                    Daily Sevas
                  </span>
                </div>
                <div>
                  24/7{' '}
                  <span className="ml-1 text-[11px] font-medium text-[#f4c956]">
                    Support
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel (form) */}
          <div className="rounded-[2rem] bg-white p-8 shadow-[0_45px_70px_-40px_rgba(15,23,42,0.55)] sm:p-10">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-semibold text-slate-900">
                  Sign in to continue
                </h2>
                <p className="text-sm text-slate-500">
                  Enter your registered mobile number and password to access your
                  dashboard.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {apiError && (
                  <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-inner">
                    {apiError}
                  </p>
                )}

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.28em] text-slate-600">
                    <span>Mobile Number</span>
                    <span className="text-[10px] text-amber-500">+91 required</span>
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200">
                    <input
                      type="tel"
                      className="w-full rounded-2xl border-0 px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      placeholder="Enter your mobile number"
                      {...register('phone_number', {
                        required: 'Mobile number is required',
                      })}
                    />
                  </div>
                  {errors.phone_number && (
                    <p className="text-xs text-rose-600">
                      {errors.phone_number.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.28em] text-slate-600">
                    <span>Password</span>
                    <Link
                      to="/forgot-password"
                      className="text-[10px] text-amber-600 hover:text-amber-700"
                    >
                      Forgot?
                    </Link>
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200">
                    <input
                      type="password"
                      className="w-full rounded-2xl border-0 px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      placeholder="Enter your password"
                      {...register('password', { required: 'Password is required' })}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-xs text-rose-600">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-gradient-to-r from-rose-600 to-amber-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Signing in…' : 'Sign In'}
                </button>

                <div className="text-center text-sm text-slate-500">
                  New devotee?{' '}
                  <Link
                    to="/register"
                    className="font-semibold text-rose-600 hover:text-rose-700"
                  >
                    Create your account
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
