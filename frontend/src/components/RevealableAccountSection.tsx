import { useEffect, useRef, useState, type ReactNode } from 'react';

const DISCLOSURE_SECONDS = 30;

type RevealableAccountSectionProps = {
  children: ReactNode;
  className?: string;
};

const RevealableAccountSection = ({ children, className = '' }: RevealableAccountSectionProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleReveal = () => {
    clearTimers();
    setIsVisible(true);
    setSecondsLeft(DISCLOSURE_SECONDS);

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    hideTimeoutRef.current = setTimeout(() => {
      clearTimers();
      setIsVisible(false);
      setSecondsLeft(0);
    }, DISCLOSURE_SECONDS * 1000);
  };

  useEffect(() => clearTimers, []);

  return (
    <div className={`relative ${className}`}>
      <div className={`transition duration-200 ${isVisible ? 'opacity-100' : 'blur-sm opacity-80'}`}>
        {children}
      </div>
      {!isVisible && (
        <button
          type="button"
          onClick={handleReveal}
          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-900/30 text-center text-sm font-semibold uppercase tracking-wide text-white shadow-inner transition hover:bg-slate-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          Click to reveal account details
        </button>
      )}
      {isVisible && secondsLeft > 0 && (
        <div className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-white/90 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500 shadow">
          Visible for {secondsLeft}s
        </div>
      )}
    </div>
  );
};

export default RevealableAccountSection;
