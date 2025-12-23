import { useCallback, useEffect, useState } from 'react';

import api from '../lib/api';

interface ProfilePayload {
  profile?: {
    custom_number?: number | null;
    monthly_donation_amount?: number | null;
  };
}

export const useCurrentBalance = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [monthlyDonation, setMonthlyDonation] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ProfilePayload>('auth/profile/');
      setBalance(response.data?.profile?.custom_number ?? null);
      setMonthlyDonation(response.data?.profile?.monthly_donation_amount ?? null);
    } catch (err) {
      setBalance(null);
      setMonthlyDonation(null);
      setError('Unable to load current balance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  return { balance, monthlyDonation, loading, error, refresh: loadBalance };
};
