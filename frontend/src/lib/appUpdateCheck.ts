const DEFAULT_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export const findAppScriptSrc = (html: string): string | null => {
  const scriptMatch = html.match(/<script\b[^>]*\bsrc=["']([^"']*\/assets\/index-[^"']+\.js)["'][^>]*>/i);
  return scriptMatch?.[1] ?? null;
};

export const normalizeAssetPath = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  try {
    return new URL(value, window.location.origin).pathname;
  } catch {
    return value;
  }
};

const getCurrentAppScriptSrc = () => {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="/assets/index-"]'));
  return normalizeAssetPath(scripts.at(-1)?.getAttribute('src'));
};

export const shouldReloadForNewAppScript = (currentScriptSrc: string | null, latestHtml: string) => {
  const latestScriptSrc = normalizeAssetPath(findAppScriptSrc(latestHtml));
  return Boolean(currentScriptSrc && latestScriptSrc && currentScriptSrc !== latestScriptSrc);
};

export const startAppUpdateCheck = (options?: {
  checkIntervalMs?: number;
  fetchHtml?: () => Promise<string>;
  reload?: () => void;
}) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined;
  }

  const checkIntervalMs = options?.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
  const fetchHtml =
    options?.fetchHtml ??
    (() =>
      fetch(`/?app-version-check=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      }).then((response) => response.text()));
  const reload = options?.reload ?? (() => window.location.reload());
  let checkInFlight = false;
  let stopped = false;

  const checkForUpdate = async () => {
    if (stopped || checkInFlight) {
      return;
    }
    checkInFlight = true;
    try {
      const currentScriptSrc = getCurrentAppScriptSrc();
      const latestHtml = await fetchHtml();
      if (!stopped && shouldReloadForNewAppScript(currentScriptSrc, latestHtml)) {
        reload();
      }
    } catch (error) {
      console.warn('Unable to check for app update', error);
    } finally {
      checkInFlight = false;
    }
  };

  const intervalId = window.setInterval(checkForUpdate, checkIntervalMs);
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void checkForUpdate();
    }
  };
  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    window.removeEventListener('focus', checkForUpdate);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};
