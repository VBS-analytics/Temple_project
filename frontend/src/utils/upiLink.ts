import { PAYMENT_UPI_ID, PAYMENT_UPI_ACCOUNT_NAME } from '../constants/paymentQr';

type BuildUpiLinkOptions = {
  amount?: number;
};

export const buildUpiLink = ({ amount }: BuildUpiLinkOptions = {}) => {
  const params = new URLSearchParams({
    pa: PAYMENT_UPI_ID,
    pn: PAYMENT_UPI_ACCOUNT_NAME,
    cu: 'INR',
  });

  if (typeof amount === 'number' && amount > 0) {
    params.set('am', amount.toFixed(2));
  }

  return `upi://pay?${params.toString()}`;
};

export const launchUpiLink = (options?: BuildUpiLinkOptions) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.location.href = buildUpiLink(options);
};
