import { useEffect, useMemo } from 'react';

import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useCartStore } from '../store/cart';
import { usePaymentStore } from '../store/payments';
import type { CartItem } from '../store/cart';

const parseCartAmount = (value?: number | string | null) => {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const computeTotalAmount = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + parseCartAmount(item.amount), 0);

const useCartSync = () => {
  const user = useAuthStore((state) => state.user);
  const cartKey = user ? String(user.id) : 'guest';
  const items = useCartStore((state) => state.itemsByUser[cartKey] ?? []);
  const setItemsForUser = useCartStore((state) => state.setItemsForUser);
  const clearGeneralPayment = usePaymentStore((state) => state.clearGeneralPayment);
  const setGeneralPayment = usePaymentStore((state) => state.setGeneralPayment);

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
  }, [cartKey, serialized, user?.id, user?.role]);

  useEffect(() => {
    if (!user || user.role !== 'donor') {
      return;
    }
    let cancelled = false;
    const loadSnapshot = async () => {
      try {
        const { data } = await api.get('pooja/cart-snapshots/');
        if (cancelled) return;
        const snapshotItems: CartItem[] = Array.isArray(data?.items) ? data.items : [];
        setItemsForUser(cartKey, snapshotItems);
        if (snapshotItems.length > 0) {
          setGeneralPayment({
            userKey: cartKey,
            items: snapshotItems,
            totalAmount: computeTotalAmount(snapshotItems),
          });
        } else {
          clearGeneralPayment(cartKey);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('Failed to load cart snapshot', err);
        }
      }
    };
    loadSnapshot();
    const handleFocus = () => {
      loadSnapshot();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadSnapshot();
      }
    };
    const intervalId = window.setInterval(() => {
      loadSnapshot();
    }, 5_000);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [cartKey, clearGeneralPayment, setGeneralPayment, setItemsForUser, user?.id, user?.role]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const currentUserId = typeof user.id === 'number' ? user.id : null;
    const itemsByDonor = new Map<number, CartItem[]>();
    items.forEach((item) => {
      const donorId = item.targetDonorId ?? currentUserId;
      if (typeof donorId !== 'number') {
        return;
      }
      if (!itemsByDonor.has(donorId)) {
        itemsByDonor.set(donorId, []);
      }
      itemsByDonor.get(donorId)!.push(item);
    });
    const donorIdsToSync = Array.from(itemsByDonor.keys()).filter(
      (donorId) => donorId !== currentUserId,
    );
    if (donorIdsToSync.length === 0) {
      return;
    }
    let cancelled = false;
    const syncTargetSnapshots = async () => {
      for (const donorId of donorIdsToSync) {
        if (cancelled) {
          return;
        }
        const donorItems = itemsByDonor.get(donorId);
        if (!donorItems || donorItems.length === 0) {
          continue;
        }
        try {
          await api.post('pooja/cart-snapshots/assign/', {
            donor_id: donorId,
            items: donorItems,
          });
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn('Failed to assign cart snapshot', err);
          }
        }
      }
    };
    syncTargetSnapshots();
    return () => {
      cancelled = true;
    };
  }, [items, user?.id]);
};

export default useCartSync;
