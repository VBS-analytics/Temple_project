import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import api from '../lib/api';
import { useAuthStore } from '../store/auth';

type FormValues = {
  phone_number: string;
  password: string;
};

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
      const detail = error?.response?.data?.detail ?? 'Unable to login. Please check your credentials.';
      setApiError(detail);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {apiError && <p className="rounded-md bg-red-100 p-3 text-sm text-red-700">{apiError}</p>}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Mobile Number</label>
        <input
          type="tel"
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          {...register('phone_number', { required: 'Mobile number is required' })}
        />
        {errors.phone_number && <p className="mt-1 text-sm text-red-600">{errors.phone_number.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          {...register('password', { required: 'Password is required' })}
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {isSubmitting ? 'Signing in…' : 'Sign In'}
      </button>
      <div className="flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="hover:underline">
          Forgot password?
        </Link>
        <Link to="/register" className="hover:underline">
          Create account
        </Link>
      </div>
    </form>
  );
};

export default LoginPage;
