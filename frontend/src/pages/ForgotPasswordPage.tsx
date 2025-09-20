import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import api from '../lib/api';

type FormValues = {
  phone_number: string;
  new_password: string;
  confirm_password: string;
  otp_code: string;
};

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormValues>({
    defaultValues: {
      phone_number: '',
      new_password: '',
      confirm_password: '',
      otp_code: '',
    },
  });
  const [otpStatus, setOtpStatus] = useState('');
  const [responseMsg, setResponseMsg] = useState('');

  const requestOtp = async () => {
    const phone = watch('phone_number');
    if (!phone) {
      setOtpStatus('Enter your mobile number first.');
      return;
    }
    try {
      const { data } = await api.post('/auth/request-otp/', {
        phone_number: phone,
        purpose: 'reset_password',
      });
      setOtpStatus(`OTP sent! (Dev preview: ${data.code})`);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? 'Could not send OTP';
      setOtpStatus(detail);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setResponseMsg('');
    try {
      await api.post('/auth/reset-password/', values);
      setResponseMsg('Password updated successfully. You can now sign in.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (error: any) {
      const detail = error?.response?.data ?? 'Unable to reset password';
      setResponseMsg(typeof detail === 'string' ? detail : 'Check OTP and try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {responseMsg && <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">{responseMsg}</p>}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Mobile Number</label>
        <input
          type="tel"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          {...register('phone_number', { required: 'Mobile number required' })}
        />
        {errors.phone_number && <p className="text-sm text-red-600">{errors.phone_number.message}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={requestOtp}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Send OTP
        </button>
        {otpStatus && <span className="text-xs text-slate-600">{otpStatus}</span>}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">OTP</label>
        <input type="text" className="w-full rounded-md border border-slate-300 px-3 py-2" {...register('otp_code', { required: 'Enter OTP' })} />
        {errors.otp_code && <p className="text-sm text-red-600">{errors.otp_code.message}</p>}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">New Password</label>
        <input
          type="password"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          {...register('new_password', { required: 'Required', minLength: { value: 6, message: 'Min 6 characters' } })}
        />
        {errors.new_password && <p className="text-sm text-red-600">{errors.new_password.message}</p>}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Confirm Password</label>
        <input
          type="password"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          {...register('confirm_password', { required: 'Required' })}
        />
        {errors.confirm_password && <p className="text-sm text-red-600">{errors.confirm_password.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {isSubmitting ? 'Updating…' : 'Reset Password'}
      </button>
      <p className="text-center text-sm text-slate-600">
        Remembered it?{' '}
        <Link to="/login" className="text-brand-600 hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
};

export default ForgotPasswordPage;
