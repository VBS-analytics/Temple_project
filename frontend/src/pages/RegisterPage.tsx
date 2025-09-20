import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

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
  password: string;
  confirm_password: string;
  otp_code: string;
}

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
      password: '',
      confirm_password: '',
      otp_code: '',
    },
  });

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
    try {
      const { data } = await api.post('/auth/register/', values);
      setAuth({ user: data.user, tokens: data.tokens });
      navigate('/dashboard');
    } catch (error: any) {
      const detail = error?.response?.data ?? error?.message ?? 'Registration failed';
      setApiError(typeof detail === 'string' ? detail : 'Unable to register. Verify your OTP and details.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {apiError && <p className="rounded-md bg-red-100 p-3 text-sm text-red-700">{apiError}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Mobile Number</label>
          <input
            type="tel"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
            {...register('phone_number', { required: 'Mobile number required' })}
          />
          {errors.phone_number && <p className="mt-1 text-sm text-red-600">{errors.phone_number.message}</p>}
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={requestOtp}
            className="mt-6 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Send OTP
          </button>
          {otpStatus && <span className="text-xs text-slate-600">{otpStatus}</span>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
            {...register('name', { required: 'Name is required' })}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">OTP</label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
            {...register('otp_code', { required: 'Enter OTP to continue' })}
          />
          {errors.otp_code && <p className="mt-1 text-sm text-red-600">{errors.otp_code.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 1</label>
          <input type="text" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('address_line1')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 2</label>
          <input type="text" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('address_line2')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Address Line 3</label>
          <input type="text" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('address_line3')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">City / Town</label>
          <input type="text" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('city')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">State</label>
          <input type="text" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('state')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">PIN Code</label>
          <input type="text" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('postal_code')} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
            {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
          <input
            type="password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
            {...register('confirm_password', { required: 'Please confirm password' })}
          />
          {errors.confirm_password && <p className="mt-1 text-sm text-red-600">{errors.confirm_password.message}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {isSubmitting ? 'Creating account…' : 'Register'}
      </button>
      <p className="text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
};

export default RegisterPage;
