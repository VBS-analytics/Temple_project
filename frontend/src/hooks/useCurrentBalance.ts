import { useCallback, useEffect, useState } from 'react';

import api from '../lib/api';

const parseNumericValue = (value?: number | string | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

interface ProfilePayload {
  profile?: {
    custom_number?: number | null;
    monthly_donation_amount?: number | null;
    opening_balance?: string | number | null;
    current_month_due?: string | number | null;
    current_month_payments?: string | number | null;
    calculated_current_balance?: string | number | null;
  };
}

export const useCurrentBalance = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [currentMonthDue, setCurrentMonthDue] = useState<number | null>(null);
  const [currentMonthPayments, setCurrentMonthPayments] = useState<number | null>(null);
  const [monthlyDonation, setMonthlyDonation] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ProfilePayload>('auth/profile/');
      const profile = response.data?.profile;
      const calculatedValue = parseNumericValue(profile?.calculated_current_balance);
      const openingValue = parseNumericValue(profile?.opening_balance);
      setBalance(calculatedValue ?? openingValue);
      setOpeningBalance(openingValue);
      setCurrentMonthDue(parseNumericValue(profile?.current_month_due));
      setCurrentMonthPayments(parseNumericValue(profile?.current_month_payments));
      setMonthlyDonation(parseNumericValue(profile?.monthly_donation_amount));
    } catch (err) {
      setBalance(null);
      setOpeningBalance(null);
      setCurrentMonthDue(null);
      setCurrentMonthPayments(null);
      setMonthlyDonation(null);
      setError('Unable to load opening balance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  return {
    balance,
    openingBalance,
    currentMonthDue,
    currentMonthPayments,
    monthlyDonation,
    loading,
    error,
    refresh: loadBalance,
  };
};
