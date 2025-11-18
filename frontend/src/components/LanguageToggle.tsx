import { useCallback, useEffect, useRef, useState } from 'react';

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

const removeGoogleBanner = () => {
  const bannerFrame = document.querySelector<HTMLIFrameElement>('.goog-te-banner-frame');
  if (bannerFrame) {
    bannerFrame.style.display = 'none';
  }
  const parent = bannerFrame?.parentElement;
  if (parent) {
    parent.style.display = 'none';
  }
  document.querySelectorAll('.goog-te-banner-frame, .goog-te-banner, #goog-gt-tt').forEach((node) => {
    const el = node as HTMLElement;
    el.style.display = 'none';
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });
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
  const [comboReady, setComboReady] = useState(false);
  const comboRef = useRef<HTMLSelectElement | null>(null);

  const ensureComboReady = useCallback((attempt = 0) => {
    const combo = document.querySelector<HTMLSelectElement>('select.goog-te-combo');
    if (combo) {
      comboRef.current = combo;
      setComboReady(true);
      removeGoogleBanner();
      return;
    }
    if (attempt < 20) {
      setTimeout(() => ensureComboReady(attempt + 1), 300);
    }
  }, []);

  const applyGoogleTranslation = useCallback(
    (lang: 'en' | 'ta') => {
      const combo = comboRef.current;
      if (!combo) {
        ensureComboReady();
        return;
      }
      const targetValue = lang === 'ta' ? 'ta' : 'en';
      if (combo.value !== targetValue) {
        combo.value = targetValue;
        combo.dispatchEvent(new Event('change'));
      }
    },
    [ensureComboReady],
  );

  const initGoogleTranslate = useCallback(() => {
    if (initialized) return;
    if (document.querySelector('select.goog-te-combo')) {
      setInitialized(true);
      ensureComboReady();
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
      ensureComboReady();
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
          ensureComboReady();
        }
      };
    }

    loadGoogleTranslateScript();
  }, [initialized, ensureComboReady]);

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
    if (!comboReady) {
      ensureComboReady();
      return;
    }
    applyGoogleTranslation(language);
    removeGoogleBanner();
  }, [language, initialized, applyGoogleTranslation, comboReady, ensureComboReady]);

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
      translate="no"
      className={`notranslate rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition ${baseStyles} ${className}`.trim()}
    >
      {label}
    </button>
  );
};

export default LanguageToggle;
