import { useEffect, useMemo } from 'react';

import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useCartStore } from '../store/cart';

const useCartSync = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const items = useCartStore((state) => state.itemsByUser[cartKey] ?? []);

  const serialized = useMemo(() => JSON.stringify(items), [items]);

  useEffect(() => {
    if (!user || user.role !== 'donor') {
      return;
    }
    const payload = serialized ? JSON.parse(serialized) : [];
    const syncCart = async () => {
      try {
        await api.put('pooja/cart-snapshots/', { items: payload });
      } catch (err) {
        // swallow errors, syncing is best-effort
        if (import.meta.env.DEV) {
          console.warn('Failed to sync cart snapshot', err);
        }
      }
    };
    syncCart();
  }, [serialized, user?.id]);
};

export default useCartSync;
