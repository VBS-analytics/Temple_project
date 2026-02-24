import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import api from '../../lib/api';

type DonationMethod = 'upi' | 'bank';

const DONATION_QR_IMAGE_URL = '/images/donation-qr-code.jpg';
const DONATION_UPI_ID = 'lakshmivenkat26@oksbi';

const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/* ─── tiny inline styles (no Tailwind dependency for the new tokens) ───────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Poppins:wght@400;500;600;700&display=swap');

  :root {
    --saffron: #E65100;
    --saffron-light: #FFF3E0;
    --saffron-mid: #F57C00;
    --blue: #1565C0;
    --blue-2: #1976D2;
    --blue-soft: #E3F2FD;
    --blue-section: #F0F4FF;
    --cream: #FFFFFF;
    --ink: #000000;
    --ink-2: #000000;
    --ink-3: #000000;
    --border: #90CAF9;
    --border-focus: #1565C0;
    --white: #FFFFFF;
    --success: #2D7D46;
    --error: #C0392B;
    --radius: 14px;
    --shadow-card: 0 2px 24px 0 rgba(21, 101, 192, 0.10), 0 1px 4px 0 rgba(21, 101, 192, 0.06);
    --shadow-hover: 0 6px 32px 0 rgba(21, 101, 192, 0.18);
  }

  .dp-wrap * { box-sizing: border-box; }
  .dp-wrap { font-family: 'Poppins', sans-serif; background: var(--cream); min-height: 100vh; }

  /* ── header ── */
  .dp-header { display: flex; align-items: center; gap: 14px; margin-bottom: 36px; }
  .dp-header-icon {
    width: 48px; height: 48px; border-radius: 14px;
    background: linear-gradient(135deg, var(--saffron) 0%, var(--saffron-mid) 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(230, 81, 0, 0.30);
  }
  .dp-header h1 {
    font-family: 'Lora', serif;
    font-size: 1.85rem; font-weight: 700; color: var(--ink);
    letter-spacing: -0.3px; margin: 0;
  }
  .dp-header-sub { font-size: 0.9rem; font-weight: 700; color: var(--ink-3); margin: 2px 0 0; }

  /* ── grid ── */
  .dp-grid { display: grid; gap: 24px; grid-template-columns: 1fr; }
  @media(min-width: 1100px) { .dp-grid { grid-template-columns: 1.2fr 0.8fr; } }

  /* ── cards ── */
  .dp-card {
    background: var(--white); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 32px;
    box-shadow: var(--shadow-card);
    transition: box-shadow .25s;
  }
  .dp-card:hover { box-shadow: var(--shadow-hover); }

  .dp-section-title {
    font-family: 'Lora', serif;
    font-size: 1.4rem; font-weight: 700; color: var(--ink);
    display: flex; align-items: center; gap: 10px; margin: 0 0 22px;
  }
  .dp-section-title::before {
    content: ''; display: block;
    width: 4px; height: 22px; border-radius: 4px;
    background: linear-gradient(180deg, var(--blue), var(--saffron));
    flex-shrink: 0;
  }

  /* ── tab toggle ── */
  .dp-tabs {
    display: grid; grid-template-columns: 1fr 1fr;
    background: var(--blue-soft); border: 1px solid var(--border);
    border-radius: 10px; padding: 4px; gap: 4px; margin-bottom: 24px;
  }
  .dp-tab {
    border: none; background: transparent; border-radius: 8px;
    padding: 10px 14px; font-family: 'Poppins', sans-serif;
    font-size: 0.88rem; font-weight: 600; cursor: pointer;
    color: var(--ink); transition: all .2s; letter-spacing: 0.01em;
  }
  .dp-tab.active {
    background: #F5C518; color: #000;
    box-shadow: 0 1px 6px rgba(245, 197, 24, 0.25);
  }
  .dp-tab:hover:not(.active) { color: var(--blue); }

  /* ── QR section ── */
  .dp-qr-container {
    border: 1.5px solid var(--border); border-radius: 14px;
    background: linear-gradient(145deg, var(--blue-section) 0%, var(--white) 100%);
    padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 6px;
    margin-bottom: 16px;
  }
  .dp-qr-label {
    font-family: 'Lora', serif;
    font-size: 0.95rem; font-weight: 700; color: var(--blue);
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  .dp-qr-img { width: 180px; height: 180px; object-fit: contain; border-radius: 8px; }

  .dp-upi-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    background: var(--blue-section); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 16px;
  }
  .dp-upi-label { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--blue); margin-bottom: 3px; }
  .dp-upi-id { font-size: 1rem; font-weight: 700; color: var(--ink); font-family: 'Poppins', sans-serif; }
  .dp-copy-btn {
    flex-shrink: 0; border: 1.5px solid var(--border);
    background: var(--white); color: var(--ink);
    border-radius: 8px; padding: 7px 16px;
    font-size: 0.8rem; font-weight: 600; cursor: pointer;
    transition: all .2s; white-space: nowrap;
  }
  .dp-copy-btn.copied { background: var(--success); color: #fff; border-color: var(--success); }
  .dp-copy-btn:hover:not(.copied) { background: var(--blue); color: #fff; border-color: var(--blue); }

  .dp-hint { text-align: center; font-size: 0.82rem; font-weight: 700; color: var(--ink-3); margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .dp-hint-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--saffron-mid); display: inline-block; }

  /* ── bank details ── */
  .dp-bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .dp-bank-field {
    background: var(--blue-section); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 16px;
  }
  .dp-bank-field.full { grid-column: 1/-1; }
  .dp-bank-key { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--blue); margin-bottom: 5px; }
  .dp-bank-val { font-size: 0.95rem; font-weight: 700; color: var(--ink); font-family: 'Poppins', sans-serif; }

  /* ── form ── */
  .dp-form-intro { font-size: 0.9rem; font-weight: 700; color: var(--ink-3); margin: -10px 0 22px; }
  .dp-field { margin-bottom: 18px; }
  .dp-field label {
    display: block; font-size: 0.68rem; font-weight: 700;
    letter-spacing: 0.10em; text-transform: uppercase;
    color: var(--blue); margin-bottom: 7px;
  }
  .dp-input {
    width: 100%; background: var(--white); border: 1.5px solid var(--border);
    border-radius: 9px; padding: 11px 14px;
    font-family: 'Poppins', sans-serif; font-size: 0.94rem; font-weight: 700; color: var(--ink);
    outline: none; transition: border-color .18s, box-shadow .18s;
  }
  .dp-input::placeholder { color: var(--ink-3); opacity: 0.45; font-weight: 600; }
  .dp-input:focus { border-color: var(--border-focus); box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.12); background: var(--white); }
  .dp-input.error { border-color: var(--error); }
  textarea.dp-input { resize: vertical; min-height: 80px; }
  .dp-error { font-size: 0.75rem; color: var(--error); margin-top: 5px; font-weight: 700; }

  .dp-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media(max-width: 540px) { .dp-row2 { grid-template-columns: 1fr; } }

  /* ── submit ── */
  .dp-submit {
    width: 100%; border: none; border-radius: 10px;
    background: linear-gradient(135deg, var(--saffron) 0%, var(--saffron-mid) 100%);
    color: #fff; font-family: 'Poppins', sans-serif; font-size: 0.92rem;
    font-weight: 700; letter-spacing: 0.03em; padding: 14px;
    cursor: pointer; transition: all .2s; margin-top: 6px;
    box-shadow: 0 4px 18px rgba(230, 81, 0, 0.30);
  }
  .dp-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(230, 81, 0, 0.40); }
  .dp-submit:active:not(:disabled) { transform: translateY(0); }
  .dp-submit:disabled { opacity: 0.65; cursor: not-allowed; }

  .dp-msg {
    margin-top: 14px; border-radius: 8px; padding: 12px 14px;
    font-size: 0.85rem; font-weight: 500;
  }
  .dp-msg.success { background: #E8F5EC; color: var(--success); border: 1px solid #B8DFC4; }
  .dp-msg.error { background: #FDE8E8; color: var(--error); border: 1px solid #F5BABA; }

  /* ── decorative om divider ── */
  .dp-divider { text-align: center; color: var(--blue); font-size: 1.1rem; margin: 4px 0 20px; letter-spacing: 6px; }
`;

const DonationPage = () => {
  const [activeMethod, setActiveMethod] = useState<DonationMethod>('upi');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const [donorName, setDonorName] = useState('');
  const [donorPhoneNo, setDonorPhoneNo] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [donationDate, setDonationDate] = useState(getTodayDate());
  const [notes, setNotes] = useState('');

  const [donorNameError, setDonorNameError] = useState<string | null>(null);
  const [donorPhoneError, setDonorPhoneError] = useState<string | null>(null);
  const [transactionIdError, setTransactionIdError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const handleCopyUpi = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(DONATION_UPI_ID);
      setCopiedUpi(true);
      window.setTimeout(() => setCopiedUpi(false), 1800);
    } catch {
      setMessage('Unable to copy UPI ID.');
      setMessageType('error');
    }
  }, []);

  const resetForm = () => {
    setDonorName(''); setDonorPhoneNo(''); setTransactionId('');
    setAmountPaid(''); setDonationDate(getTodayDate()); setNotes('');
  };

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage('');
      setDonorNameError(null); setDonorPhoneError(null);
      setTransactionIdError(null); setAmountError(null); setDateError(null);

      const trimmedDonorName = donorName.trim();
      const trimmedDonorPhoneNo = donorPhoneNo.trim();
      const trimmedTransactionId = transactionId.trim();
      const parsedAmount = Number(amountPaid);

      if (!trimmedDonorName)    { setDonorNameError('Donor name is required.'); return; }
      if (!trimmedDonorPhoneNo) { setDonorPhoneError('Phone number is required.'); return; }
      if (!trimmedTransactionId){ setTransactionIdError('Transaction ID is required.'); return; }
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { setAmountError('Enter a valid donation amount.'); return; }
      if (!donationDate)        { setDateError('Donation date is required.'); return; }

      setIsSubmitting(true);
      try {
        await api.post('payments/donations/', {
          donor_name: trimmedDonorName,
          donor_phone_no: trimmedDonorPhoneNo,
          transaction_id: trimmedTransactionId,
          amount_paid: parsedAmount,
          donation_date: donationDate,
          notes: notes.trim(),
        });
        setMessage('🙏 Donation recorded successfully. Thank you for your generosity!');
        setMessageType('success');
        resetForm();
      } catch (error: any) {
        const responseData = error?.response?.data;
        const detail = responseData?.detail;
        let fallbackMessage = 'Unable to record donation right now. Please try again.';
        if (!detail && responseData && typeof responseData === 'object') {
          const firstError = Object.values(responseData).find((value) => {
            if (typeof value === 'string') return true;
            return Array.isArray(value) && typeof value[0] === 'string';
          });
          if (typeof firstError === 'string') {
            fallbackMessage = firstError;
          } else if (Array.isArray(firstError) && typeof firstError[0] === 'string') {
            fallbackMessage = firstError[0];
          }
        }
        setMessage(typeof detail === 'string' ? detail : fallbackMessage);
        setMessageType('error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [amountPaid, donationDate, donorName, donorPhoneNo, notes, transactionId],
  );

  return (
    <>
      <style>{css}</style>
      <div className="dp-wrap">
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px 60px' }}>
          
          {/* Header */}
          <header className="dp-header">
            <div className="dp-header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8c-1.2-1.7-4.1-2.2-5.9-.3C4 9.8 4.2 13.2 6.8 15.3L12 20l5.2-4.7c2.6-2.1 2.8-5.5.7-7.6-1.8-1.9-4.7-1.4-5.9.3z" />
              </svg>
            </div>
            <div>
              <h1>General Donation</h1>
              <p className="dp-header-sub">Support our temple with your generous contribution</p>
            </div>
          </header>

          <div className="dp-grid">
            {/* ── LEFT: Donation Method ── */}
            <section className="dp-card">
              <h2 className="dp-section-title">Donation Method</h2>

              {/* Tabs */}
              <div className="dp-tabs">
                <button
                  type="button"
                  className={`dp-tab${activeMethod === 'upi' ? ' active' : ''}`}
                  onClick={() => setActiveMethod('upi')}
                >
                  📱 UPI Payment
                </button>
                <button
                  type="button"
                  className={`dp-tab${activeMethod === 'bank' ? ' active' : ''}`}
                  onClick={() => setActiveMethod('bank')}
                >
                  🏦 Bank Transfer
                </button>
              </div>

              {activeMethod === 'upi' ? (
                <>
                  <div className="dp-qr-container">
                    <p className="dp-qr-label">Scan to Donate</p>
                    <img src={DONATION_QR_IMAGE_URL} alt="Donation QR Code" className="dp-qr-img" />
                  </div>

                  <div className="dp-upi-row">
                    <div>
                      <p className="dp-upi-label">UPI ID</p>
                      <p className="dp-upi-id">{DONATION_UPI_ID}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className={`dp-copy-btn${copiedUpi ? ' copied' : ''}`}
                      aria-label="Copy UPI ID"
                    >
                      {copiedUpi ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>

                  <p className="dp-hint">
                    <span className="dp-hint-dot" />
                    Scan with any UPI app — PhonePe, GPay, Paytm, BHIM
                    <span className="dp-hint-dot" />
                  </p>
                </>
              ) : (
                <>
                  <div className="dp-divider">✦ ✦ ✦</div>
                  <div className="dp-bank-grid">
                    <div className="dp-bank-field full">
                      <p className="dp-bank-key">Account Holder</p>
                      <p className="dp-bank-val">Lakshmi V</p>
                    </div>
                    <div className="dp-bank-field">
                      <p className="dp-bank-key">Account Number</p>
                      <p className="dp-bank-val">1430104000056920</p>
                    </div>
                    <div className="dp-bank-field">
                      <p className="dp-bank-key">IFSC Code</p>
                      <p className="dp-bank-val">IBKL0001430</p>
                    </div>
                  </div>
                  <p className="dp-hint" style={{ marginTop: 18 }}>
                    <span className="dp-hint-dot" />
                    Use NEFT / IMPS / RTGS for instant transfers
                    <span className="dp-hint-dot" />
                  </p>
                </>
              )}
            </section>

            {/* ── RIGHT: Record Donation ── */}
            <section className="dp-card">
              <h2 className="dp-section-title">Record Donation</h2>
              <p className="dp-form-intro">After completing your payment, fill in the details below so we can acknowledge your contribution.</p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="dp-field">
                  <label htmlFor="donor-name">Donor Name</label>
                  <input
                    id="donor-name" type="text" value={donorName}
                    onChange={e => { setDonorName(e.target.value); if (donorNameError) setDonorNameError(null); }}
                    placeholder="Full name of donor"
                    className={`dp-input${donorNameError ? ' error' : ''}`}
                  />
                  {donorNameError && <p className="dp-error">{donorNameError}</p>}
                </div>

                <div className="dp-field">
                  <label htmlFor="donor-phone">Donor Phone No</label>
                  <input
                    id="donor-phone" type="tel" value={donorPhoneNo}
                    onChange={e => { setDonorPhoneNo(e.target.value); if (donorPhoneError) setDonorPhoneError(null); }}
                    placeholder="+91 98765 43210"
                    className={`dp-input${donorPhoneError ? ' error' : ''}`}
                  />
                  {donorPhoneError && <p className="dp-error">{donorPhoneError}</p>}
                </div>

                <div className="dp-row2">
                  <div className="dp-field" style={{ marginBottom: 0 }}>
                    <label htmlFor="donation-amount">Amount Paid (₹)</label>
                    <input
                      id="donation-amount" type="number" min="0" step="0.01" inputMode="decimal"
                      value={amountPaid}
                      onChange={e => { setAmountPaid(e.target.value); if (amountError) setAmountError(null); }}
                      placeholder="0.00"
                      className={`dp-input${amountError ? ' error' : ''}`}
                    />
                    {amountError && <p className="dp-error">{amountError}</p>}
                  </div>
                  <div className="dp-field" style={{ marginBottom: 0 }}>
                    <label htmlFor="donation-date">Donation Date</label>
                    <input
                      id="donation-date" type="date" value={donationDate}
                      onKeyDown={e => e.preventDefault()}
                      onChange={e => { setDonationDate(e.target.value); if (dateError) setDateError(null); }}
                      className={`dp-input${dateError ? ' error' : ''}`}
                    />
                    {dateError && <p className="dp-error">{dateError}</p>}
                  </div>
                </div>

                <div className="dp-field" style={{ marginTop: 18 }}>
                  <label htmlFor="donation-transaction-id">Transaction ID / UPI Reference</label>
                  <input
                    id="donation-transaction-id" type="text" value={transactionId}
                    onChange={e => { setTransactionId(e.target.value); if (transactionIdError) setTransactionIdError(null); }}
                    placeholder="e.g. 412345678901"
                    className={`dp-input${transactionIdError ? ' error' : ''}`}
                  />
                  {transactionIdError && <p className="dp-error">{transactionIdError}</p>}
                </div>

                <div className="dp-field">
                  <label htmlFor="donation-notes">Notes <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                  <textarea
                    id="donation-notes" value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. For Ganesh Puja, in memory of..."
                    className="dp-input"
                  />
                </div>

                <button type="submit" className="dp-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : '🙏 Save Donation'}
                </button>

                {message && (
                  <div className={`dp-msg ${messageType}`}>{message}</div>
                )}
              </form>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default DonationPage;
