import { useCallback, useEffect, useState } from 'react';

import useLanguageStore from '../store/language';

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

const loadGoogleTranslateScript = () => {
  if (document.getElementById('google-translate-script')) {
    return;
  }

  const script = document.createElement('script');
  script.id = 'google-translate-script';
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.body.appendChild(script);
};

const ensureTranslateContainer = () => {
  if (!document.getElementById('google_translate_element')) {
    const container = document.createElement('div');
    container.id = 'google_translate_element';
    container.style.display = 'none';
    document.body.appendChild(container);
  }
};

const applyGoogleTranslation = (lang: 'en' | 'ta', attempt = 0) => {
  const combo = document.querySelector<HTMLSelectElement>('select.goog-te-combo');
  if (!combo) {
    if (attempt < 10) {
      setTimeout(() => applyGoogleTranslation(lang, attempt + 1), 300);
    }
    return;
  }

  const targetValue = lang === 'ta' ? 'ta' : 'en';
  if (combo.value !== targetValue) {
    combo.value = targetValue;
    combo.dispatchEvent(new Event('change'));
  }
};

const removeGoogleBanner = () => {
  const bannerFrame = document.querySelector<HTMLIFrameElement>('.goog-te-banner-frame');
  if (bannerFrame) {
    bannerFrame.style.display = 'none';
  }
  const bannerParent = document.querySelector('.goog-te-banner-frame');
  if (bannerParent && bannerParent.parentNode) {
    bannerParent.parentNode.removeChild(bannerParent);
  }
  const body = document.body;
  if (body) {
    body.style.top = '0px';
  }
};

type LanguageToggleProps = {
  theme?: 'light' | 'dark';
  className?: string;
};

const LanguageToggle = ({ theme = 'dark', className = '' }: LanguageToggleProps) => {
  const { language, setLanguage } = useLanguageStore();
  const [initialized, setInitialized] = useState(false);

  const initGoogleTranslate = useCallback(() => {
    if (initialized) return;
    if (document.querySelector('select.goog-te-combo')) {
      setInitialized(true);
      return;
    }
    if (window.google?.translate?.TranslateElement) {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: 'ta,en',
          autoDisplay: false,
        },
        'google_translate_element',
      );
      setInitialized(true);
      return;
    }

    if (!window.googleTranslateElementInit) {
      window.googleTranslateElementInit = () => {
        if (window.google?.translate?.TranslateElement) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              includedLanguages: 'ta,en',
              autoDisplay: false,
            },
            'google_translate_element',
          );
          setInitialized(true);
        }
      };
    }

    loadGoogleTranslateScript();
  }, [initialized]);

  useEffect(() => {
    ensureTranslateContainer();
    initGoogleTranslate();
    removeGoogleBanner();
    const interval = setInterval(removeGoogleBanner, 300);
    const observer = new MutationObserver(() => removeGoogleBanner());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [initGoogleTranslate]);

  useEffect(() => {
    if (!initialized) return;
    applyGoogleTranslation(language);
    removeGoogleBanner();
  }, [language, initialized]);

  const handleClick = () => {
    const nextLang = language === 'en' ? 'ta' : 'en';
    setLanguage(nextLang);
    applyGoogleTranslation(nextLang);
  };

  const label = language === 'en' ? 'தமிழ்' : 'English';
  const baseStyles =
    theme === 'dark'
      ? 'border-white/40 text-white hover:bg-white/10'
      : 'border-slate-300 text-slate-700 hover:bg-slate-100';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition ${baseStyles} ${className}`.trim()}
    >
      {label}
    </button>
  );
};

export default LanguageToggle;
